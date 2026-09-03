# Changelog

All notable changes to this project are documented in this file.

## [Unreleased]

### Removed
- `jira-proxy-server-v2.js` — an unreferenced alternate proxy implementation not used by `Dockerfile.jira-proxy`, `docker-compose.yml`, or `package.json`; removed as dead code ahead of the initial GitHub push.

### Changed
- `Dockerfile.jira-proxy` now installs with `npm ci` against the (now-committed) lockfile instead of `npm install`, and runs the proxy as the image's built-in non-root `node` user instead of root.
- Scrubbed hardcoded real tenant/company values (`herffjones.atlassian.net`, personal email) from `jira-critical-path.html` and `SETUP.md`, replacing them with generic placeholders/examples ahead of the initial GitHub push.
- Added `.gitignore` and `.dockerignore`; `logs/` (runtime exports containing real JIRA data) is now excluded from both the git repo and the Docker build context.
- Generated `package-lock.json` (previously missing) and ran `npm audit fix` to resolve 2 of 3 moderate transitive advisories in `express`'s dependency tree.
- Added a demo GIF (`docs/demo.gif`, synthetic sample data) to `README.md` showing dependency-graph navigation, zoom, and pan.

### Fixed
- Default JQL of `ORDER BY updated ASC` (no restriction clause) triggered `JIRA API error: 400` — "Unbounded JQL queries are not allowed here" — from the `/rest/api/3/search/jql` endpoint. Changed the default to `project is not EMPTY ORDER BY updated ASC`, which satisfies JIRA's required restriction clause while still matching every issue across every accessible project (`jira-critical-path.html`).

### Added
- Color coding by issue type (Epic, Story, Task, Sub-task, Bug, Improvement, Test, Initiative) and by status (To Do, In Progress, In Review, Done), with legends, in both the dependency graph and the data grid (`jira-critical-path.html`). Graph nodes now fill by status and use a colored ring for issue type; a dashed gold halo marks issues on the critical path. The table's Type column and the issue detail panel now show a colored type badge alongside the existing status badge.

### Changed
- Remapped `docker-compose.yml` host ports to avoid conflicts with other local containers already on this machine: `jira-proxy` moved from `3000:3000` to `3002:3000` (conflicted with `silverbullet`), `jira-frontend` moved from `8080:80` to `8085:80` (conflicted with `portainer-dashboard`). Updated the default "Proxy Server URL" in `jira-critical-path.html` to `http://localhost:3002` and the port references in `README.md`/`SETUP.md` to match.
- Default JQL query in `jira-critical-path.html` no longer hardcodes `project = TMD`; it now queries all projects the authenticated user has access to (`ORDER BY updated ASC`), so results can cross projects. Updated the JQL field placeholder and `README.md` to reflect the new default.

### Added
- Initial `Changelog.md`, `backlog.md`, and `CLAUDE.md` project scaffolding.
- `README.md` project overview.

## [1.0.0] - 2026-08-19

### Added
- JIRA Critical Path Analyzer: single-file HTML client (`jira-critical-path.html`) for visualizing JIRA issue dependency graphs, table view, and critical path calculation.
- Node.js/Express proxy server (`jira-proxy-server.js`, `jira-proxy-server-v2.js`) exposing `POST /api/jira-search`, `POST /api/validate-credentials`, and `GET /health` to work around JIRA Cloud API CORS restrictions.
- Docker Compose stack (`docker-compose.yml`) running `jira-proxy` (Node, port 3000) and `jira-frontend` (Nginx, port 8080) on a shared `jira-analyzer` bridge network, with healthcheck-gated startup ordering.
- `Dockerfile.jira-proxy` for building the proxy server image (node:18-alpine).
- `nginx.conf` for serving the static analyzer frontend.
- `SETUP.md` documenting three setup paths (Docker Compose, standalone proxy add-on, local Node), JQL examples, troubleshooting, and the proxy API reference.
