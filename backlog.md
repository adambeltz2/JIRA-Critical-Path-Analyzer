# Backlog

Non-critical bugs, feature ideas, refactors, and tech debt discovered during work but out of scope for the current task. Log items here instead of implementing them on the fly.

Format: `[TAG] Description — affected files`

## Open Items

- [FEATURE] Add team burndown metrics — `jira-critical-path.html`
- [FEATURE] Add webhook integration for real-time updates — `jira-proxy-server.js`
- [FEATURE] Export to Smartsheet/Monday.com for portfolio view — `jira-critical-path.html`
- [FEATURE] Build n8n workflow to run analysis on a schedule — infra/n8n (external)
- [FEATURE][P2] Add rate limiting to the proxy endpoint before any public/production deployment — `jira-proxy-server.js`
- [FEATURE][P2] Add optional API key authentication to the proxy — `jira-proxy-server.js`
- [DEBT][P3] No automated tests exist for the proxy server endpoints — `jira-proxy-server.js`
- [FEATURE] Add a "Full JSON Export" button that dumps the raw, unflattened issue data for every fetched ticket to CSV (one row per issue, one column per JSON field path, not just the curated field set `exportCSV` currently uses) — for manual spot-checking/validation of the raw JIRA payload — `jira-critical-path.html`
- [DEBT] `npm audit` still reports one moderate `qs`/`express` transitive DoS advisory after `npm audit fix`; full remediation needs an `express` major-version bump, which is out of scope for a pre-GitHub cleanup pass — `package.json`, `package-lock.json`
- [FEATURE] No image tag pinning by digest for `node:18-alpine` — consider pinning to a specific digest for reproducible builds once this repo has CI — `Dockerfile`, `docker-compose.yml`
- [FEATURE][P2] CORS on the proxy is unrestricted (`cors()` with no origin allowlist in `jira-proxy-server.js`) — fine on localhost, but lock it to the frontend's origin before deploying anywhere reachable beyond your machine — `jira-proxy-server.js`
