const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Create logs directory
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Middleware

// CORS is only needed when the client is served from a different origin than this proxy
// (e.g. Option B in SETUP.md, or a custom deployment). The default single-image deployment
// serves the client from GET / on this same origin, so same-origin fetches work with no CORS
// headers at all — leaving ALLOWED_ORIGIN unset disables cross-origin access entirely, which
// is the safest default for anything reachable beyond localhost.
const allowedOrigin = process.env.ALLOWED_ORIGIN;
if (allowedOrigin) {
  app.use(cors({ origin: allowedOrigin }));
}

// Raised from the default 100kb — a full CSV export for a large tenant (tens of thousands of
// issues) comfortably exceeds that.
app.use(express.json({ limit: '100mb' }));

// Optional shared-secret auth for the /api/* routes. Off by default (no API_KEY set) to keep
// the out-of-the-box Docker Hub image working with zero config; set API_KEY to require every
// /api/* request to carry a matching X-API-Key header before it's allowed through to JIRA —
// this proxy will otherwise happily relay a request to *any* tenantUrl the caller supplies, so
// anyone who can reach it on the network can use it as an open relay without this.
// /health is intentionally excluded so the Docker healthcheck (which doesn't send this header)
// keeps working regardless.
const apiKey = process.env.API_KEY;
function requireApiKey(req, res, next) {
  if (!apiKey) return next();
  const provided = req.get('X-API-Key') || '';
  const expected = Buffer.from(apiKey);
  const actual = Buffer.from(provided);
  const valid = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  if (!valid) {
    return res.status(401).json({ error: 'Unauthorized — missing or invalid X-API-Key header' });
  }
  next();
}

// Simple in-memory fixed-window rate limiter, per client IP, scoped to /api/*. This is a
// single-process/single-container deployment (no shared store across replicas), which is all
// this needs — it's here to blunt casual abuse/credential-stuffing against the proxy, not to
// stand in for a production API gateway. Configurable via env vars since tenant/query size
// varies a lot; defaults are generous for a single interactive user.
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 30;
const rateLimitHits = new Map(); // ip -> { count, windowStart }
setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS;
  for (const [ip, entry] of rateLimitHits) {
    if (entry.windowStart < cutoff) rateLimitHits.delete(ip);
  }
}, RATE_LIMIT_WINDOW_MS).unref();

function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const entry = rateLimitHits.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitHits.set(ip, { count: 1, windowStart: now });
    return next();
  }
  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ error: 'Too many requests — please slow down and try again shortly.' });
  }
  next();
}

app.use('/api', rateLimit, requireApiKey);

// Serve the single-file client at the root. Deliberately not express.static(__dirname) —
// that would also expose package.json, this server's own source, and anything else dropped
// in this directory. res.sendFile only ever serves this one named file.
app.get('/', (req, res) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN',
    'X-XSS-Protection': '1; mode=block'
  });
  res.sendFile(path.join(__dirname, 'jira-critical-path.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Clear logs endpoint
app.post('/api/clear-logs', (req, res) => {
  try {
    const files = fs.readdirSync(logsDir);
    files.forEach(file => {
      fs.unlinkSync(path.join(logsDir, file));
    });
    console.log(`[LOGS] Cleared ${files.length} log files`);
    res.json({ message: `Cleared ${files.length} log files` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a completed run's CSV export into the logs folder (mounted to ./logs on the host via
// the docker-compose volume) so a finished analysis always leaves an artifact behind.
app.post('/api/save-export', (req, res) => {
  try {
    const { filename, content } = req.body;

    if (!filename || typeof content !== 'string') {
      return res.status(400).json({ error: 'Missing required fields: filename, content' });
    }

    // Strip any directory components and reject anything that isn't a plain .csv name —
    // this is user/browser-supplied and must not be able to write outside logsDir.
    const safeName = path.basename(filename);
    if (!/^[\w.-]+\.csv$/i.test(safeName)) {
      return res.status(400).json({ error: 'Invalid filename — expected a plain .csv filename' });
    }

    const filePath = path.join(logsDir, safeName);
    fs.writeFileSync(filePath, content);
    console.log(`[EXPORT] Saved CSV export to ${filePath} (${content.length} bytes)`);
    res.json({ filename: safeName });
  } catch (error) {
    console.error('[EXPORT] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Lists accessible projects and site-wide issue types, so the client can offer a scope picker
// (which projects / issue types to include) before running the potentially large main search.
app.post('/api/jira-metadata', async (req, res) => {
  try {
    const { tenantUrl, email, token } = req.body;

    if (!tenantUrl || !email || !token) {
      return res.status(400).json({ error: 'Missing required fields: tenantUrl, email, token' });
    }

    const baseUrl = tenantUrl.replace(/\/$/, '');
    const auth = { username: email, password: token };
    const headers = { 'Accept': 'application/json', 'User-Agent': 'JIRA-Analyzer-Proxy/1.0' };

    console.log(`[METADATA] Fetching projects and issue types for ${email}`);

    const projects = [];
    let startAt = 0;
    while (true) {
      const response = await axios.get(`${baseUrl}/rest/api/3/project/search`, {
        params: { startAt, maxResults: 100, orderBy: 'key' },
        auth,
        headers
      });
      projects.push(...response.data.values.map(p => ({ key: p.key, name: p.name })));
      if (response.data.isLast || projects.length >= response.data.total) break;
      startAt += 100;
    }

    const issueTypesResponse = await axios.get(`${baseUrl}/rest/api/3/issuetype`, { auth, headers });
    const seenNames = new Set();
    const issueTypes = [];
    issueTypesResponse.data.forEach(t => {
      if (!seenNames.has(t.name)) {
        seenNames.add(t.name);
        issueTypes.push({ id: t.id, name: t.name, subtask: !!t.subtask });
      }
    });
    issueTypes.sort((a, b) => a.name.localeCompare(b.name));

    console.log(`[METADATA] Found ${projects.length} project(s), ${issueTypes.length} issue type(s)`);
    res.json({ projects, issueTypes });
  } catch (error) {
    console.error('[METADATA] Error:', error.message);
    if (error.response) {
      return res.status(error.response.status).json({
        error: `JIRA API error: ${error.response.status}`,
        details: error.response.data
      });
    }
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message
    });
  }
});

// Helper to write response to log file
function logResponse(filename, data) {
  const filepath = path.join(logsDir, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
}

// Proxy endpoint for JIRA API
app.post('/api/jira-search', async (req, res) => {
  try {
    // NOTE: this endpoint always fetches and returns the entire JQL result set in one response
    // (it pages internally against JIRA via nextPageToken) — it does not support a per-call
    // startAt/maxResults slice, so no startAt is accepted here.
    const { tenantUrl, email, token, jql, maxResults = 5000 } = req.body;

    if (!tenantUrl || !email || !token || !jql) {
      return res.status(400).json({ error: 'Missing required fields: tenantUrl, email, token, jql' });
    }

    // Clear this run's own debug page dumps from the previous search — but leave anything else
    // in logsDir alone (in particular, CSV exports saved via /api/save-export) so a new run
    // doesn't delete the artifact from the last completed one.
    const files = fs.readdirSync(logsDir).filter(f => /^page-\d+\.json$/.test(f));
    files.forEach(file => {
      fs.unlinkSync(path.join(logsDir, file));
    });
    console.log(`[LOGS] Cleared ${files.length} previous page-dump files`);

    // Construct JIRA API URL - use new jql endpoint with GET
    const baseUrl = tenantUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/rest/api/3/search/jql`;

    console.log(`[SEARCH] Request from: ${email}`);
    console.log(`[SEARCH] Token length: ${token.length}`);
    console.log(`[SEARCH] URL: ${apiUrl}`);
    console.log(`[SEARCH] JQL: ${jql}`);
    console.log(`[SEARCH] Method: GET with query params`);

    const allIssues = [];
    let nextPageToken = null;
    let pageNum = 1;
    let fieldNames = null;
    let streamStarted = false;

    // Cancel the in-flight JIRA request(s) if the client disconnects (e.g. a UI "stop" button
    // calling AbortController.abort() on its fetch) instead of continuing to hammer JIRA in the
    // background for a response nobody is waiting on.
    //
    // NOTE: this must be res.on('close'), not req.on('close'). express.json() fully drains the
    // request body before this handler runs, and req's 'close' event then fires almost
    // immediately regardless of whether the client is still connected — it falsely cancelled
    // every search on arrival. res tracks the actual response/connection lifecycle instead.
    const upstreamAbort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) {
        console.log('[SEARCH] Client disconnected — cancelling upstream JIRA request(s)');
        upstreamAbort.abort();
      }
    });

    // Once the first page succeeds, switch to a newline-delimited-JSON stream (one JSON
    // object per line) so the client can show real page-by-page progress instead of waiting
    // silently on one large response. JIRA's nextPageToken pagination is inherently
    // sequential — each page's token only exists in the previous page's response — so this
    // doesn't speed up the fetch itself, only makes its progress visible.
    const startStream = () => {
      if (!streamStarted) {
        streamStarted = true;
        res.status(200);
        res.set('Content-Type', 'application/x-ndjson');
        res.set('Cache-Control', 'no-cache');
      }
    };
    const writeLine = (obj) => res.write(JSON.stringify(obj) + '\n');

    // Paginate through results using nextPageToken
    while (true) {
      const params = {
        jql: jql,
        maxResults: maxResults,
        fields: '*all',
        expand: 'names'
      };

      // Add token if this isn't the first page
      if (nextPageToken) {
        params.nextPageToken = nextPageToken;
      }

      console.log(`[SEARCH] Fetching page ${pageNum}...`);
      if (nextPageToken) {
        console.log(`[SEARCH] Using token: ${nextPageToken.substring(0, 50)}...`);
      }

      console.log(`[SEARCH] Params being sent:`, JSON.stringify(params));

      const response = await axios.get(apiUrl, {
        params: params,
        auth: {
          username: email,
          password: token
        },
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'JIRA-Analyzer-Proxy/1.0'
        },
        signal: upstreamAbort.signal
      });

      console.log(`[SEARCH] Response URL: ${response.config.url}`);

      // Log full response
      const logData = {
        page: pageNum,
        timestamp: new Date().toISOString(),
        params: params,
        issueCount: response.data.issues?.length || 0,
        isLast: response.data.isLast,
        hasNextToken: !!response.data.nextPageToken,
        totalIssuesSoFar: allIssues.length + (response.data.issues?.length || 0),
        issues: response.data.issues  // Log full issues array
      };
      
      logResponse(`page-${pageNum.toString().padStart(3, '0')}.json`, logData);
      console.log(`[SEARCH] Logged to page-${pageNum.toString().padStart(3, '0')}.json`);

      if (!fieldNames && response.data.names) {
        fieldNames = response.data.names;
      }

      const pageIssues = response.data.issues || [];
      allIssues.push(...pageIssues);
      console.log(`[SEARCH] Page ${pageNum}: Got ${pageIssues.length} issues (total: ${allIssues.length})`);
      console.log(`[SEARCH] isLast: ${response.data.isLast}, nextPageToken exists: ${!!response.data.nextPageToken}`);

      startStream();
      writeLine({ type: 'progress', page: pageNum, issuesThisPage: pageIssues.length, issuesSoFar: allIssues.length });

      // Check if there are more pages
      if (response.data.isLast === true || !response.data.nextPageToken) {
        console.log(`[SEARCH] ✓ Pagination complete: ${allIssues.length} total issues`);
        break;
      }

      nextPageToken = response.data.nextPageToken;
      console.log(`[SEARCH] Next token: ${nextPageToken.substring(0, 50)}...`);
      pageNum++;

      // Safety limit to prevent infinite loops
      if (pageNum > 1000) {
        console.error(`[SEARCH] ✗ Safety limit reached (1000 pages). Stopping.`);
        break;
      }
    }

    // Final line of the stream carries the complete result set.
    writeLine({
      type: 'done',
      issues: allIssues,
      total: allIssues.length,
      startAt: 0,
      maxResults: allIssues.length,
      names: fieldNames || {}
    });
    res.end();

  } catch (error) {
    console.error('[SEARCH] Error:', error.message);

    // Client already disconnected (e.g. cancelled via the UI) — nothing to respond to.
    if (res.writableEnded || axios.isCancel(error) || error.code === 'ERR_CANCELED') {
      console.log('[SEARCH] Request cancelled — no response sent');
      return;
    }

    if (res.headersSent) {
      // Already streaming NDJSON to the client (at least one page succeeded) — can't switch
      // back to a plain error status/body at this point, so signal the failure as one more
      // line in the stream instead.
      const errPayload = error.response
        ? { type: 'error', error: `JIRA API error: ${error.response.status}`, details: error.response.data }
        : { type: 'error', error: error.message };
      try {
        res.write(JSON.stringify(errPayload) + '\n');
      } catch (writeErr) {
        console.error('[SEARCH] Failed to write error line to stream:', writeErr.message);
      }
      return res.end();
    }

    if (error.response) {
      console.error('[SEARCH] Status:', error.response.status);
      console.error('[SEARCH] Data:', error.response.data);
      return res.status(error.response.status).json({
        error: `JIRA API error: ${error.response.status}`,
        details: error.response.data
      });
    }
    res.status(500).json({
      error: 'Proxy server error',
      message: error.message
    });
  }
});

// Test endpoint to validate credentials
app.post('/api/validate-credentials', async (req, res) => {
  try {
    const { tenantUrl, email, token } = req.body;

    if (!tenantUrl || !email || !token) {
      return res.status(400).json({ valid: false, error: 'Missing credentials' });
    }

    const baseUrl = tenantUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/rest/api/3/myself`;

    console.log(`[VALIDATE] Testing credentials for ${email}`);
    console.log(`[VALIDATE] Token length: ${token.length}`);
    console.log(`[VALIDATE] URL: ${apiUrl}`);

    const response = await axios.get(apiUrl, {
      auth: {
        username: email,
        password: token
      },
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'JIRA-Analyzer-Proxy/1.0'
      }
    });

    const userData = response.data;
    console.log(`[VALIDATE] ✓ Success: ${userData.displayName}`);
    res.json({ 
      valid: true, 
      user: userData.displayName,
      email: userData.emailAddress,
      accountId: userData.accountId
    });

  } catch (error) {
    console.error('[VALIDATE] Error:', error.message);
    if (error.response) {
      console.error('[VALIDATE] Status:', error.response.status);
      console.error('[VALIDATE] Data:', error.response.data);
      return res.json({ 
        valid: false, 
        error: `Auth failed: ${error.response.status}`,
        details: error.response.data
      });
    }
    res.status(500).json({ 
      valid: false, 
      error: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🔗 JIRA Proxy Server listening on http://localhost:${PORT}`);
  console.log(`   POST /api/jira-search - Proxy JIRA search requests`);
  console.log(`   POST /api/validate-credentials - Test JIRA credentials`);
  console.log(`   GET /health - Health check`);
});
