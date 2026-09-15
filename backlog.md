# Backlog

Non-critical bugs, feature ideas, refactors, and tech debt discovered during work but out of scope for the current task. Log items here instead of implementing them on the fly.

Format: `[TAG] Description — affected files`

## Open Items

- [FEATURE] Add team burndown metrics — `jira-critical-path.html`
- [FEATURE] Add webhook integration for real-time updates — `jira-proxy-server.js`
- [FEATURE] Export to Smartsheet/Monday.com for portfolio view — `jira-critical-path.html`
- [FEATURE] Build n8n workflow to run analysis on a schedule — infra/n8n (external)
- [DEBT][P3] No automated tests exist for the proxy server endpoints — `jira-proxy-server.js`
- [FEATURE] Add a "Full JSON Export" button that dumps the raw, unflattened issue data for every fetched ticket to CSV (one row per issue, one column per JSON field path, not just the curated field set `exportCSV` currently uses) — for manual spot-checking/validation of the raw JIRA payload — `jira-critical-path.html`
- [DEBT] `npm audit` still reports one moderate `qs`/`express` transitive DoS advisory after `npm audit fix`; full remediation needs an `express` major-version bump, which is out of scope for a pre-GitHub cleanup pass — `package.json`, `package-lock.json`
- [FEATURE] No image tag pinning by digest for `node:18-alpine` — consider pinning to a specific digest for reproducible builds — `Dockerfile`, `docker-compose.yml`
- [DEBT] The rate limiter added in `jira-proxy-server.js` (`RATE_LIMIT_MAX`/`RATE_LIMIT_WINDOW_MS`) is in-memory and per-process — fine for this single-container deployment, but would need a shared store (e.g. Redis) if this were ever run as multiple replicas behind a load balancer — `jira-proxy-server.js`
