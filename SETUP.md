# JIRA Critical Path Analyzer — Setup Guide

A production-ready tool to extract JIRA dependencies, visualize relationships, and identify blockers across all accessible projects.

## Architecture

```
┌─────────────────────────┐
│  Browser / Client       │
│  (served from GET /)    │
└────────────┬────────────┘
             │
             │ POST /api/jira-search
             │ (proxy URL, tenant, email, token, JQL)
             │
┌────────────▼────────────┐
│  Node.js Proxy Server   │
│  (port 3000)            │
│  serves the HTML client │
│  AND the /api/* routes  │
└────────────┬────────────┘
             │
             │ Basic Auth via HTTPS
             │
┌────────────▼────────────┐
│  JIRA Cloud API         │
│  (REST API v3)          │
└─────────────────────────┘
```

This ships as **one container / one image** — `jira-proxy-server.js` serves the static
`jira-critical-path.html` client at `GET /` in addition to the `/api/*` proxy routes, so
there's no separate frontend container or nginx to run alongside it.

## Setup Options

### Option 1: Docker Hub (Recommended)

Pull and run the published image directly — no clone or build required.

```bash
docker run -d \
  --name jira-analyzer \
  -p 3000:3000 \
  -v "$(pwd)/logs:/app/logs" \
  --restart unless-stopped \
  <your-dockerhub-username>/jira-critical-path-analyzer:latest
```

Then open `http://localhost:3000` — the Proxy URL field is pre-filled with the page's own
origin, so you only need to fill in your Tenant URL, email, API token, and JQL before
clicking **Fetch & Analyze**.

See [Building & Publishing to Docker Hub](#building--publishing-to-docker-hub) below for how
this image gets built and pushed in the first place.

### Option 2: Docker Compose (build locally)

**Prerequisites:**
- Docker & Docker Compose
- Git (to clone this repo)

**Steps:**

1. **Clone the repo:**
   ```bash
   git clone https://github.com/adambeltz2/JIRA-Critical-Path-Analyzer.git
   cd JIRA-Critical-Path-Analyzer
   ```

2. **Create the logs directory and make it writable by the container:**
   ```bash
   mkdir -p logs
   chmod 777 logs
   ```

   The container runs as the non-root `node` user (uid 1000, per `Dockerfile`), but
   `docker-compose.yml` bind-mounts your host's `./logs` over `/app/logs` — and a fresh
   `git clone` leaves that directory `755`, owned by whatever user cloned the repo. If that
   uid isn't 1000, every `/api/save-export` call and the per-page debug log writes in
   `/api/jira-search` fail with `EACCES`. The container itself stays up and `/health` still
   passes, so this failure only shows up as a 500 response from those two endpoints. Running
   the `chmod` above (or `chown -R 1000:1000 logs` if you'd rather not open it up to all
   users) avoids that. Skip this step for Option 1, where there's no host clone.

3. **Build and run:**
   ```bash
   docker compose up -d --remove-orphans
   ```

   This builds the image from the repo's `Dockerfile` and starts the single `jira-analyzer`
   service on port 3000, with `./logs` bind-mounted to `/app/logs` in the container.

4. **Verify the container is running:**
   ```bash
   docker compose ps
   ```

5. **Access the app:**
   - Open browser: `http://localhost:3000`
   - The **Proxy URL** field is pre-filled with the page's own origin (`http://localhost:3000`)
     — leave it as-is.
   - Fill in:
     - **Tenant URL:** `https://subdomain.atlassian.net`
     - **Email:** Your Atlassian email
     - **API Token:** Your JIRA API token (from https://id.atlassian.com/manage-profile/security/api-tokens)
     - **JQL:** `project = TMD` or leave default
   - Click **"Fetch & Analyze"**

6. **Stop the container:**
   ```bash
   docker compose down
   ```

> If port 3000 is already taken on your machine, change the host-side mapping in
> `docker-compose.yml` (e.g. `"3002:3000"`) — the container always listens on 3000
> internally.

### Option 3: Local Node.js (for testing, no Docker)

**Prerequisites:**
- Node.js 18+
- npm

**Steps:**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   node jira-proxy-server.js
   ```

   Output: `🔗 JIRA Proxy Server listening on http://localhost:3000`

3. **Open `http://localhost:3000` in your browser** — the server serves the client itself,
   so there's nothing else to open or run.

4. **In the form:**
   - Proxy URL is pre-filled with `http://localhost:3000`
   - Fill in your tenant URL, email, and API token
   - Click "Fetch & Analyze"

## Building & Publishing to Docker Hub

These are the exact steps to build this repo's image and push it to your own Docker Hub
account, so `docker run <your-username>/jira-critical-path-analyzer` (Option 1 above) works
for anyone.

**Prerequisites:**
- Docker installed and running
- A [Docker Hub](https://hub.docker.com/) account
- A repository created on Docker Hub (e.g. `<your-username>/jira-critical-path-analyzer`) —
  or just push once and Docker Hub will offer to create it for you

**Steps:**

1. **Clone the repo** (if you haven't already):
   ```bash
   git clone https://github.com/adambeltz2/JIRA-Critical-Path-Analyzer.git
   cd JIRA-Critical-Path-Analyzer
   ```

2. **Log in to Docker Hub:**
   ```bash
   docker login
   ```

3. **Build the image**, tagged with your Docker Hub username/repo:
   ```bash
   docker build -t <your-dockerhub-username>/jira-critical-path-analyzer:latest .
   ```

   To also tag a specific version (recommended — pin to the app version in
   `jira-critical-path.html`'s `APP_VERSION` constant, e.g. `1.9.0`):
   ```bash
   docker build \
     -t <your-dockerhub-username>/jira-critical-path-analyzer:latest \
     -t <your-dockerhub-username>/jira-critical-path-analyzer:1.9.0 \
     .
   ```

4. **(Optional) Test the image locally before pushing:**
   ```bash
   docker run -d --name jira-analyzer-test -p 3000:3000 \
     <your-dockerhub-username>/jira-critical-path-analyzer:latest
   curl http://localhost:3000/health
   docker stop jira-analyzer-test && docker rm jira-analyzer-test
   ```

5. **Push to Docker Hub:**
   ```bash
   docker push <your-dockerhub-username>/jira-critical-path-analyzer:latest
   docker push <your-dockerhub-username>/jira-critical-path-analyzer:1.9.0
   ```

6. **Verify:** visit `https://hub.docker.com/r/<your-dockerhub-username>/jira-critical-path-analyzer`
   and confirm the tag(s) are listed.

Anyone can now run it with the `docker run` command from Option 1, substituting your
Docker Hub username.

> The steps above are for a manual, one-off publish. This repo also has an automated path:
> [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml) builds and
> pushes `<your-dockerhub-username>/jira-critical-path-analyzer:latest` and
> `:<version>` whenever a `v*` tag is pushed (e.g. `git tag v1.9.0 && git push origin v1.9.0`).
> It requires two repo secrets under **Settings → Secrets and variables → Actions**:
> `DOCKERHUB_USERNAME` (your Docker Hub username) and `DOCKERHUB_TOKEN` (a Docker Hub
> [access token](https://hub.docker.com/settings/security), not your account password —
> scope it to Read & Write on this repo only). Until those secrets are set, the workflow
> run will fail at the login step; the manual steps above remain the fallback.

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
1. The server is running on port 3000
2. Proxy URL field is filled in form (pre-filled with the page's own origin by default,
   since the same server serves both the client and the API)
3. If you changed it away from the default, point it back at wherever this server is
   actually reachable, e.g. `http://localhost:3000`

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

### Container won't start
**Fix:**
1. Check logs: `docker logs jira-analyzer` (or `docker compose logs -f`)
2. Ensure port 3000 is available: `lsof -i :3000`
3. Rebuild: `docker compose build --no-cache`

### "Fetch & Analyze" works, but export/save fails with a 500 and an EACCES error
**Cause:** The container runs as the non-root `node` user (uid 1000), but `docker-compose.yml`
bind-mounts your host's `./logs` over `/app/logs`. A `git clone` typically leaves `logs/`
`755` and owned by whatever user cloned the repo — if that isn't uid 1000, the container
can't write to it. `/health` and the rest of the app keep working, so this only shows up on
`/api/save-export` and the per-page debug log writes in `/api/jira-search`.
**Fix:**
```bash
chmod 777 logs
# or, to avoid opening it up to all users:
chown -R 1000:1000 logs
docker compose restart
```

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

Fetch and search JIRA issues with dependencies. This endpoint always fetches the **entire**
matching result set — it pages internally against JIRA using `nextPageToken` until JIRA
reports the last page. It does not support a per-call `startAt`/page slice; `maxResults`
only controls the page size used for each internal request to JIRA, not how much is
returned to the caller. Callers should make one request and not loop.

The response is **newline-delimited JSON** (one JSON object per line), not a single JSON
body, since JIRA's pagination is sequential and can take a while on a large tenant — this
lets the caller show real progress instead of waiting silently:
- `{"type":"progress","page":N,"issuesThisPage":n,"issuesSoFar":m}` — one line per
  internally-fetched JIRA page.
- `{"type":"done","issues":[...],"total":n,"startAt":0,"maxResults":n,"names":{...}}` — the
  final line once pagination completes, carrying the full merged result set.
- `{"type":"error","error":"...","details":{...}}` — if a page *after* the first fails
  (status is already committed as 200 by then, so the failure can't be reported via HTTP
  status; this line is the only signal). A failure on the very first page instead returns a
  normal non-2xx JSON error response (nothing has streamed yet in that case).

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

**Response (streamed, one JSON object per line):**
```
{"type":"progress","page":1,"issuesThisPage":5000,"issuesSoFar":5000}
{"type":"progress","page":2,"issuesThisPage":237,"issuesSoFar":5237}
{"type":"done","startAt":0,"maxResults":5237,"total":5237,"names":{"customfield_10020":"Sprint"},"issues":[{"key":"TMD-837","fields":{"summary":"Create Attribute: Default Stone Value","duedate":"2024-06-30","customfield_10020":[{"id":42,"name":"Sprint 23","state":"active","endDate":"2024-06-28T00:00:00.000Z"}],"issuelinks":[{"type":{"name":"Relates"},"outwardIssue":{"key":"TMD-838"}}]}]}
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

1. **Use HTTPS** — put a reverse proxy (Nginx, Caddy, Traefik) in front of this container
   for TLS; the container itself only speaks plain HTTP on 3000
2. **Rate limit** the endpoint
3. **Add authentication** (optional API key)
4. **Lock down CORS** to your actual frontend origin instead of the current wide-open default
5. **Monitor logs** for suspicious activity

Example: Deploy to an internal server via Kubernetes/container orchestration, pulling the
image built in [Building & Publishing to Docker Hub](#building--publishing-to-docker-hub).

## Next Steps

- Add **Team burndown** metrics
- Add **Webhook integration** for real-time updates
- Export to **Smartsheet/Monday.com** for portfolio view
- Build **n8n workflow** to run analysis on schedule

## Support

Issues? Check:
1. Browser console (F12 → Console tab) for JavaScript errors
2. Container logs: `docker logs jira-analyzer`
3. Verify JIRA API token is valid
4. Try a simple JQL: `project = TMD limit 10`

---

**JIRA Critical Path Analyzer.**  
**Single file, proxy-based, production-ready.**
