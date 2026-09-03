# Changelog

All notable changes to this project are documented in this file.

## [1.2.0] - 2026-09-03

### Added
- Gantt tab in `jira-critical-path.html`, shown once any fetched issue has a due date. Each
  bar's start is approximated from the issue's `created` date (Jira has no native start-date
  field) and its end from `duedate`; critical-path issues get a gold dashed outline and a
  "today" reference line marks the current date. A new "Export CSV" button in the tab writes
  one row per issue with its computed start/end/duration via a new `buildGanttCSV`, alongside
  the existing table export.

## [1.1.1] - 2026-09-03

### Fixed
- CSV/formula injection in `buildCSV` (`jira-critical-path.html`): a cell value starting
  with `=`, `+`, `-`, or `@` is now prefixed with a leading `'` before quoting, so a crafted
  JIRA field value (e.g. a summary of `=HYPERLINK(...)`) renders as inert text instead of
  executing as a formula/DDE payload when the export is opened in Excel/Sheets. Fixes both
  the manual "Export CSV" button and the automatic post-run export written to `logs/` via
  `/api/save-export`, since both go through the same `buildCSV` function.

## [1.1.0] - 2026-09-03

### Changed
- Replaced the two-container Docker setup (`jira-proxy` + `jira-frontend`/nginx) with a
  single image: `Dockerfile` builds one `node:18-alpine` container running
  `jira-proxy-server.js`, which now also serves `jira-critical-path.html` at `GET /` via
  `res.sendFile` (not `express.static`, so no other file is exposed). `docker-compose.yml`
  now runs one `jira-analyzer` service on port 3000. Removed `Dockerfile.jira-proxy` and
  `nginx.conf`.
- `jira-critical-path.html`'s Proxy URL field now defaults to `window.location.origin`
  instead of a hardcoded port, since the client and proxy are always same-origin in this
  deployment.
- Replaced the exponential per-node DFS in `calculateCriticalPath` with a linear
  topological-sort + DP pass.
- `/api/jira-search` now streams progress as newline-delimited JSON (one line per
  internally-fetched JIRA page, then a final line with the merged result) instead of
  returning a single response after the entire multi-page fetch completes silently.
- Rewrote `SETUP.md` and `README.md` for the single-image architecture, and added a
  step-by-step "Building & Publishing to Docker Hub" section to `SETUP.md`.

## [1.0.0] - 2026-09-02

### Added
- JIRA Critical Path Analyzer: single-file HTML client (`jira-critical-path.html`) for visualizing JIRA issue dependency graphs, table view, and critical path calculation, with color coding by issue type and status.
- Node.js/Express proxy server (`jira-proxy-server.js`) exposing `POST /api/jira-search`, `POST /api/jira-metadata`, `POST /api/validate-credentials`, `POST /api/save-export`, and `GET /health` to work around JIRA Cloud API CORS restrictions.
- Docker Compose stack (`docker-compose.yml`) running `jira-proxy` (Node, port 3002→3000) and `jira-frontend` (Nginx, port 8085→80) on a shared `jira-analyzer` bridge network, with healthcheck-gated startup ordering. The proxy container runs as a non-root user.
- `Dockerfile.jira-proxy` for building the proxy server image (node:18-alpine).
- `nginx.conf` for serving the static analyzer frontend.
- `SETUP.md` documenting setup paths (Docker Compose, standalone proxy, local Node), JQL examples, troubleshooting, and the proxy API reference.
- `README.md` project overview with a demo GIF (`docs/demo.gif`).
