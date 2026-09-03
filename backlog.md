# Backlog

Non-critical bugs, feature ideas, refactors, and tech debt discovered during work but out of scope for the current task. Log items here instead of implementing them on the fly.

Format: `[TAG] Description — affected files`

## Open Items

- [FEATURE] Add Gantt view if due dates exist on issues — `jira-critical-path.html`
- [FEATURE] Add team burndown metrics — `jira-critical-path.html`
- [FEATURE] Add webhook integration for real-time updates — `jira-proxy-server.js`
- [FEATURE] Export to Smartsheet/Monday.com for portfolio view — `jira-critical-path.html`
- [FEATURE] Build n8n workflow to run analysis on a schedule — infra/n8n (external)
- [DEBT] `SETUP.md` references `docker-compose.jira-analyzer.yml`, but the actual file in this repo is `docker-compose.yml` — reconcile naming — `SETUP.md`, `docker-compose.yml`
- [FEATURE][P2] Add rate limiting to the proxy endpoint before any public/production deployment — `jira-proxy-server.js`
- [FEATURE][P2] Add optional API key authentication to the proxy — `jira-proxy-server.js`
- [DEBT][P3] No automated tests exist for the proxy server endpoints — `jira-proxy-server.js`
- [FEATURE] Add a "Full JSON Export" button that dumps the raw, unflattened issue data for every fetched ticket to CSV (one row per issue, one column per JSON field path, not just the curated field set `exportCSV` currently uses) — for manual spot-checking/validation of the raw JIRA payload — `jira-critical-path.html`
- [BUG] `/api/jira-search`'s internal `nextPageToken` loop against JIRA (`jira-proxy-server.js`) runs strictly sequentially, one page at a time — a large tenant (25k+ issues) takes many minutes for a single fetch since each internal page waits on the previous one; was masked until now by a client-side bug (fixed) that multiplied this wait several times over via duplicate re-fetches. Consider a progress-streaming response (SSE/chunked) so the UI can show real page-by-page progress instead of one long silent wait — `jira-proxy-server.js`, `jira-critical-path.html`
- [DEBT] `npm audit` still reports one moderate `qs`/`express` transitive DoS advisory after `npm audit fix`; full remediation needs an `express` major-version bump, which is out of scope for a pre-GitHub cleanup pass — `package.json`, `package-lock.json`
- [FEATURE] No image tag pinning by digest for `node:18-alpine` / `nginx:alpine` — consider pinning to a specific digest for reproducible builds once this repo has CI — `Dockerfile.jira-proxy`, `docker-compose.yml`
- [FEATURE][P2] CORS on the proxy is unrestricted (`cors()` with no origin allowlist in `jira-proxy-server.js`) — fine on localhost, but lock it to the frontend's origin before deploying anywhere reachable beyond your machine — `jira-proxy-server.js`
- [BUG] `buildCSV` (`jira-critical-path.html`) quotes cells for CSV syntax but doesn't neutralize leading `=`/`+`/`-`/`@` characters — a JIRA issue summary crafted to start with one of those is interpreted as a formula/DDE payload by Excel/Sheets when the export is opened (classic CSV/formula injection). `/api/save-export` (`jira-proxy-server.js`) persists the same unsanitized content to `logs/` on every run. Prefix such cells with a leading `'` (or similar neutralization) before quoting.
- [BUG][P1] `calculateCriticalPath` (`jira-critical-path.html`) runs an unmemoized DFS from every issue to find the longest blocker chain — cycle-safe (backtracking `visited` set prevents infinite recursion) but not polynomial: any diamond-shaped dependency graph (multiple tickets sharing a common blocker, common in real JIRA data) causes redundant path exploration that can blow up combinatorially on large tenants (25k+ issues, per the pagination item below). Longest path in a DAG is linear time via topological sort + single relaxation pass; consider replacing the per-node DFS with that.
- [BUG][P1] `/api/jira-search`'s internal `nextPageToken` loop (`jira-proxy-server.js`) runs strictly sequentially — compounds with the critical-path DFS blowup above on large tenants (25k+ issues); worth tackling alongside it since both are "large tenant" scaling problems.
- [DEBT][P3] `docker-compose.yml` bind-mounts `./logs:/app/logs` into a container that (per `Dockerfile.jira-proxy`) runs as the non-root `node` user (uid 1000), but nothing guarantees the host `logs/` directory is writable by that uid — a `git clone` typically leaves it `755` owned by the cloning user, which silently breaks every `/api/save-export` call and the per-page debug log writes in `/api/jira-search` with EACCES (the `/health` check still passes, so the failure isn't obvious from `docker compose ps`). Document a `chmod`/`chown` step in `SETUP.md`, or relax the directory's permissions at build/start time.
- [DEBT][P3] `CLAUDE.md` lists `jira-proxy-server-v2.js` as part of the primary server ecosystem, but no such file exists in this repo — only `jira-proxy-server.js` is present. Same class of stale-reference issue as the `docker-compose.jira-analyzer.yml` mismatch above; reconcile both in the same pass.
