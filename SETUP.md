# JIRA Critical Path Analyzer — Setup Guide

A production-ready tool to extract JIRA dependencies, visualize relationships, and identify blockers across all accessible projects.

## Architecture

```
┌─────────────────────────┐
│  Browser / Client       │
│  (jira-critical-path.html)
└────────────┬────────────┘
             │
             │ POST /api/jira-search
             │ (proxy URL, tenant, email, token, JQL)
             │
┌────────────▼────────────┐
│  Node.js Proxy Server   │
│  (port 3000)            │
└────────────┬────────────┘
             │
             │ Basic Auth via HTTPS
             │
┌────────────▼────────────┐
│  JIRA Cloud API         │
│  (REST API v3)          │
└─────────────────────────┘
```

## Setup Options

### Option 1: Docker Compose (Recommended)

**Prerequisites:**
- Docker & Docker Compose
- Git (optional, to clone)

**Steps:**

1. **Create a project directory:**
   ```bash
   mkdir jira-analyzer && cd jira-analyzer
   ```

2. **Copy these files into the directory:**
   - `jira-critical-path.html`
   - `jira-proxy-server.js`
   - `package.json`
   - `Dockerfile.jira-proxy`
   - `docker-compose.jira-analyzer.yml`
   - `nginx.conf`

3. **Build and run:**
   ```bash
   docker-compose -f docker-compose.jira-analyzer.yml up -d
   ```

4. **Verify containers are running:**
   ```bash
   docker ps | grep jira-
   ```

   You should see:
   - `jira-proxy` (Node.js) — port 3000 (this repo's `docker-compose.yml` maps it to host port **3002** — 3000 was already taken by another container)
   - `jira-frontend` (Nginx) — port 8080 (mapped to host port **8085** here — 8080 was already taken by another container)

   > If ports 3000/8080 are free on your machine, feel free to change the host-side mapping back in `docker-compose.yml`. Check what's free first: `lsof -i :3000` / `lsof -i :8080`.

5. **Access the app:**
   - Open browser: `http://localhost:8085`
   - Fill in form with:
     - **Proxy URL:** `http://jira-proxy:3000` (internal Docker network) or `http://localhost:3002` from your browser
     - **Tenant URL:** `https://subdomain.atlassian.net`
     - **Email:** Your Atlassian email
     - **API Token:** Your JIRA API token (from https://id.atlassian.com/manage-profile/security/api-tokens)
     - **JQL:** `project = TMD` or leave default
   - Click **"Fetch & Analyze"**

6. **Stop containers:**
   ```bash
   docker-compose -f docker-compose.jira-analyzer.yml down
   ```

### Option 2: Standalone Node.js Proxy (for existing Docker Compose stack)

If you want to add the proxy to your existing Proxmox/Docker Compose stack:

1. **Copy `jira-proxy-server.js` and `package.json` to your stack directory**

2. **Add to your main `docker-compose.yml`:**
   ```yaml
   jira-proxy:
     build:
       context: .
       dockerfile: Dockerfile.jira-proxy
     ports:
       - "3000:3000"
     restart: unless-stopped
     networks:
       - your-network-name
   ```

3. **Open the HTML file locally or serve it via your existing Nginx/web server**

4. **In the app form, set Proxy URL to:**
   - `http://jira-proxy:3000` (if same Docker network)
   - `http://localhost:3000` (if running locally in browser)

### Option 3: Local Node.js (for testing)

**Prerequisites:**
- Node.js 16+
- npm

**Steps:**

1. **Install dependencies:**
   ```bash
   npm install express cors node-fetch
   ```

2. **Start the proxy:**
   ```bash
   node jira-proxy-server.js
   ```

   Output: `🔗 JIRA Proxy Server listening on http://localhost:3000`

3. **Open the HTML file in your browser:**
   - Locally: `file:///path/to/jira-critical-path.html`
   - Or serve via any HTTP server (e.g., `python -m http.server 8000`)

4. **In the form:**
   - Proxy URL: `http://localhost:3000`
   - Fill in your tenant URL, email, and API token
   - Click "Fetch & Analyze"

## Getting Your JIRA API Token

1. Go to **https://id.atlassian.com/manage-profile/security/api-tokens**
2. Click **"Create API token"**
3. Give it a name (e.g., "JIRA Analyzer")
4. Copy the token and paste it into the form
5. **Never commit this token to Git** — it's like a password

## Features

### 📊 Dependency Graph
- **Interactive canvas** with zoom, pan, drag
- **Node colors:**
  - 🔵 Blue = Regular issue
  - 🔴 Red = Blocking issue
  - 🟡 Yellow = On critical path
- **Edge types:**
  - Solid red line = **blocks** relationship
  - Dashed gray line = **relates to** relationship
- **Click any node** to see details, blockers, blocked items

### 📋 Table View
- **Sortable columns:** Key, Summary, Status, Priority, Assignee, Blocker Count, Critical Path
- **Filterable:** Search by key, summary, or assignee name
- **Exportable:** CSV with all metadata + computed fields
  - Key, Summary, Type, Status, Priority, Assignee, Blocker Count, Is Blocked By, On Critical Path

### 🎯 Critical Path Calculation
- **Longest chain of blocking dependencies** to any issue
- Highlighted in **yellow** on graph
- Marked in table for quick identification
- Useful for identifying dependencies that might delay project completion

### 📈 Statistics
- Total issues
- Total dependencies
- Critical path length
- Count of blocked issues

## JQL Examples

Use these in the JQL field to filter which issues to analyze:

```jql
# All issues in a project
project = TMD

# Issues in progress
project = TMD AND status = "In Progress"

# High priority blockers
project = TMD AND priority = High AND type in (Task, Bug)

# Issues updated in last week
project = TMD AND updated >= -7d

# Exclude done items
project = TMD AND status != Done

# Specific epic
parent = TMD-16

# Multiple projects
project in (TMD, CAL) AND resolution is EMPTY

# All accessible issues (default)
order by updated DESC
```

## Troubleshooting

### Error: "NetworkError when attempting to fetch resource"
**Cause:** CORS issue — HTML is trying to call JIRA API directly
**Fix:** Use the proxy server! Make sure:
1. Proxy is running on port 3000
2. Proxy URL field is filled in form
3. If running locally: `http://localhost:3000`
4. If Docker: `http://jira-proxy:3000` or network hostname

### Error: "JIRA API error: 401"
**Cause:** Invalid credentials
**Fix:**
1. Check email is correct
2. Check API token is valid (not expired)
3. Generate a new token at https://id.atlassian.com/manage-profile/security/api-tokens

### Error: "JIRA API error: 403"
**Cause:** User doesn't have permission to view certain issues
**Fix:**
1. User account may not have access to some projects
2. Try a JQL filter: `project = TMD` (just one project)

### Proxy container won't start
**Fix:**
1. Check logs: `docker logs jira-proxy`
2. Ensure port 3000 is available: `lsof -i :3000`
3. Rebuild: `docker-compose -f docker-compose.jira-analyzer.yml build --no-cache`

### Graph rendering is slow (1000+ issues)
**Fix:**
1. Reduce dataset via JQL: `project = TMD AND status != Done`
2. Increase browser memory
3. Force graph refresh by clicking "Fetch & Analyze" again

## Performance Notes

- **Up to 1000 issues:** Smooth visualization
- **1000-5000 issues:** Slower force simulation, still usable
- **5000+ issues:** Consider breaking into multiple JQL queries per project

## Security

- **Credentials stored locally in browser** — never sent to anyone but JIRA
- **Proxy only proxies to JIRA** — no data logging
- **Use HTTPS in production** — if deploying publicly
- **API tokens are passwords** — treat accordingly

## API Reference (Proxy Server)

### POST /api/jira-search

Fetch and search JIRA issues with dependencies. This endpoint always returns the **entire**
matching result set in a single response — it pages internally against JIRA using
`nextPageToken` until JIRA reports the last page, then returns everything at once. It does
not support a per-call `startAt`/page slice; `maxResults` only controls the page size used
for each internal request to JIRA, not how much is returned to the caller. Callers should
make one request and not loop.

**Request:**
```json
{
  "tenantUrl": "https://subdomain.atlassian.net",
  "email": "user@example.com",
  "token": "api-token-here",
  "jql": "project = TMD",
  "maxResults": 5000
}
```

**Response:**
```json
{
  "startAt": 0,
  "maxResults": 237,
  "total": 237,
  "names": {
    "customfield_10020": "Sprint"
  },
  "issues": [
    {
      "key": "TMD-837",
      "fields": {
        "summary": "Create Attribute: Default Stone Value",
        "duedate": "2024-06-30",
        "customfield_10020": [
          { "id": 42, "name": "Sprint 23", "state": "active", "endDate": "2024-06-28T00:00:00.000Z" }
        ],
        "issuelinks": [
          {
            "type": { "name": "Relates" },
            "outwardIssue": { "key": "TMD-838", ... }
          }
        ],
        ...
      }
    }
  ]
}
```

### POST /api/jira-metadata

Lists accessible projects and site-wide issue types, so the client can offer a scope picker
(narrow the run to specific projects/issue types) before running the main search.

**Request:**
```json
{
  "tenantUrl": "https://subdomain.atlassian.net",
  "email": "user@example.com",
  "token": "api-token-here"
}
```

**Response:**
```json
{
  "projects": [
    { "key": "TMD", "name": "Team Demo" }
  ],
  "issueTypes": [
    { "id": "10001", "name": "Bug", "subtask": false }
  ]
}
```

### POST /api/validate-credentials

Test if credentials are valid.

**Request:**
```json
{
  "tenantUrl": "https://subdomain.atlassian.net",
  "email": "user@example.com",
  "token": "api-token-here"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "user": "Adam Beltz",
  "email": "email@yourdomain.com"
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2026-08-17T15:30:45.000Z"
}
```

### POST /api/save-export

Saves a CSV export into the proxy's `logs/` folder (mounted to `./logs` on the host via the
docker-compose volume). Called automatically by the client once a fetch/analysis run completes,
so every finished run leaves a CSV behind without a manual export step. `filename` is sanitized
server-side (basename only, must match `*.csv`) to prevent writing outside `logs/`.

**Request:**
```json
{
  "filename": "jira-analysis-2026-08-17T15-30-45-000Z.csv",
  "content": "Key,Summary,Type,...\nTMD-837,Create Attribute...,Task,...\n"
}
```

**Response:**
```json
{
  "filename": "jira-analysis-2026-08-17T15-30-45-000Z.csv"
}
```

## Deployment to Production

If deploying to a cloud server or internal server:

1. **Use HTTPS** — configure Nginx with SSL cert
2. **Rate limit** the proxy endpoint
3. **Add authentication** to proxy (optional API key)
4. **Store proxy & frontend on separate IPs/domains**
5. **Monitor logs** for suspicious activity

Example: Deploy to an internal server via Kubernetes/container orchestration.

## Next Steps

- Add **Gantt view** (if due dates exist)
- Add **Team burndown** metrics
- Add **Webhook integration** for real-time updates
- Export to **Smartsheet/Monday.com** for portfolio view
- Build **n8n workflow** to run analysis on schedule

## Support

Issues? Check:
1. Browser console (F12 → Console tab) for JavaScript errors
2. Proxy logs: `docker logs jira-proxy`
3. Verify JIRA API token is valid
4. Try a simple JQL: `project = TMD limit 10`

---

**JIRA Critical Path Analyzer.**  
**Single file, proxy-based, production-ready.**
