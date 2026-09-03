# JIRA Critical Path Analyzer

A production-ready tool to extract JIRA dependencies, visualize relationships, and identify blockers across all accessible projects.

![Demo: navigating the dependency graph, zooming, panning, and switching views](docs/demo.gif)

*Demo runs against a synthetic sample dataset — not real JIRA data.*

## What's in this repo

| File | Purpose |
|---|---|
| [jira-critical-path.html](jira-critical-path.html) | Single-file client: dependency graph, table view, critical path calculation |
| [jira-proxy-server.js](jira-proxy-server.js) | Node/Express proxy to JIRA Cloud REST API v3 (works around browser CORS) |
| [Dockerfile.jira-proxy](Dockerfile.jira-proxy) | Image build for the proxy server |
| [docker-compose.yml](docker-compose.yml) | Runs `jira-proxy` (host port 3002 → container 3000) + `jira-frontend` (host port 8085 → container 80) |
| [nginx.conf](nginx.conf) | Static file serving config for the frontend container |
| [package.json](package.json) | Proxy server dependencies (`express`, `cors`, `axios`) |

## Quick start

### Clone the repo

```bash
git clone https://github.com/adambeltz2/JIRA-Critical-Path-Analyzer.git
cd JIRA-Critical-Path-Analyzer
```

Requires [Docker](https://docs.docker.com/get-docker/) and Docker Compose (bundled with Docker Desktop) to run the steps below. See [SETUP.md](SETUP.md) if you'd rather run the proxy standalone with local Node instead of Docker.

### Run it

```bash
docker compose up -d --remove-orphans
```

Then open `http://localhost:8085` and fill in:
- **Proxy URL:** `http://localhost:3002` (pre-filled as the form default)
- **Tenant URL:** your Atlassian domain, e.g. `https://yourcompany.atlassian.net`
- **Email / API Token:** from [id.atlassian.com/manage-profile/security/api-tokens](https://id.atlassian.com/manage-profile/security/api-tokens)
- **JQL:** leave blank (default) to pull every issue across all projects you have access to, or scope it, e.g. `project = TMD`

Click **Fetch & Analyze**.

### Filtering to a single project

The default query (`project is not EMPTY ORDER BY updated ASC`) pulls every issue across every project you can access. To limit the fetch to one project, replace the JQL field with:

```
project = TMD ORDER BY updated ASC
```

Swap `TMD` for your project's key (visible in its issue keys, e.g. `TMD-123`). This is the same field the default query lives in — just overwrite it before clicking **Fetch & Analyze**. More JQL examples (multiple projects, status filters, date ranges) are in [SETUP.md](SETUP.md).

Full setup options (Docker Compose, standalone proxy, local Node), JQL examples, troubleshooting, and the proxy API reference live in [SETUP.md](SETUP.md).

## Architecture

```
Browser (jira-critical-path.html)
        │  POST /api/jira-search
        ▼
Node.js Proxy Server (port 3000)
        │  Basic Auth via HTTPS
        ▼
JIRA Cloud API (REST v3)
```

The proxy exists solely to work around CORS — it does not persist or transform JIRA data.

## Features

- **Dependency graph** — interactive canvas (zoom/pan/drag), color-coded nodes (regular / blocking / critical path), edge types for *blocks* vs *relates to*
- **Table view** — sortable, filterable, exportable to CSV
- **Critical path calculation** — longest chain of blocking dependencies
- **Stats** — total issues, dependencies, critical path length, blocked issue count

## Security

- Credentials are entered in the browser and passed through the proxy per-request — never logged or persisted
- Treat your JIRA API token like a password; never commit it to Git
- Use HTTPS if deploying beyond localhost

## Other docs

- [SETUP.md](SETUP.md) — detailed setup, troubleshooting, API reference
- [Changelog.md](Changelog.md) — release history
- [backlog.md](backlog.md) — known gaps and deferred work
- [CLAUDE.md](CLAUDE.md) — agent working conventions for this repo
