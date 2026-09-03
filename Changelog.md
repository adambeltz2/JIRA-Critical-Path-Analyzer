# Changelog

All notable changes to this project are documented in this file.

## [1.0.0] - 2026-09-02

### Added
- JIRA Critical Path Analyzer: single-file HTML client (`jira-critical-path.html`) for visualizing JIRA issue dependency graphs, table view, and critical path calculation, with color coding by issue type and status.
- Node.js/Express proxy server (`jira-proxy-server.js`) exposing `POST /api/jira-search`, `POST /api/jira-metadata`, `POST /api/validate-credentials`, `POST /api/save-export`, and `GET /health` to work around JIRA Cloud API CORS restrictions.
- Docker Compose stack (`docker-compose.yml`) running `jira-proxy` (Node, port 3002→3000) and `jira-frontend` (Nginx, port 8085→80) on a shared `jira-analyzer` bridge network, with healthcheck-gated startup ordering. The proxy container runs as a non-root user.
- `Dockerfile.jira-proxy` for building the proxy server image (node:18-alpine).
- `nginx.conf` for serving the static analyzer frontend.
- `SETUP.md` documenting setup paths (Docker Compose, standalone proxy, local Node), JQL examples, troubleshooting, and the proxy API reference.
- `README.md` project overview with a demo GIF (`docs/demo.gif`).
