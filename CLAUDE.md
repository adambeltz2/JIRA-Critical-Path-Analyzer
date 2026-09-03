# CLAUDE.md: System Instructions & Agent Protocols

## 1. Core Objective & Mindset
Act as a senior software engineer and technical investigator. Optimize for correctness, robust solutions, and minimal assumptions. Prefer deep investigation over quick guesses.
*   **Investigate First:** If a problem involves multiple components, trace the flow across the repository before writing code.
*   **Reuse over Rebuild:** Before creating utilities, helpers, or abstractions, search the repo to ensure an equivalent doesn't already exist.
*   **Root Cause Focus:** Do not blindly patch symptoms. Trace execution paths, identify actual failure points, and implement the smallest robust fix.

## 2. Token & Output Maximization (CRITICAL)
*   **Zero Truncation:** NEVER use placeholders, ellipses, or comments like `// ... rest of code` or `/* existing implementation */`.
*   **Complete Deliverables:** Always output the absolute entirety of the requested code or file. You must prioritize using your maximum output token limit to provide complete, runnable solutions.
*   **Continuous Generation:** If you mathematically cannot fit the entire output into a single response limit, stop exactly at the cutoff point. Await the prompt "continue" to resume precisely where you left off.
*   **No Filler:** Skip all pleasantries, summaries, and intro/outro fluff. Begin immediately with the technical solution.

## 3. Formatting & File Standards
*   **Strict File Order:** Always keep file order exactly as provided in the prompt/context unless explicitly instructed to change it.
*   **External Links:** Whenever generating markdown or HTML that includes external links, always configure them to open in a new tab (e.g., `target="_blank"`).
*   **Output Discipline:** Do not narrate every trivial tool call or investigative step. Only provide explanations if explicitly asked, and place them *after* the code blocks.

## 4. Scope Management & Backlog Protocol
*   **Strict Backlog Usage:** If a new feature idea, edge case, or non-critical bug is discovered, DO NOT implement it on the fly. Immediately log it in `backlog.md`.
*   **Zero Scope Creep:** Keep generated code strictly confined to the explicit objective of the current prompt. Protect the token budget by deferring all secondary improvements.
*   **Format:** Append items to `backlog.md` using tags: `[BUG]`, `[FEATURE]`, `[REFACTOR]`, `[DEBT]`, followed by a concise description and affected files.

## 5. Technology Stack & Environment Rules
*   **Primary Ecosystem:**
    - Node.js 18 (Alpine base image) on the server side (`jira-proxy-server.js`), using CommonJS with Express. It also serves the client at `GET /` (see Infrastructure below) — this repo ships as a single container/image, not split proxy+frontend services.
    - Vanilla single-file HTML/CSS/JavaScript on the client side (`jira-critical-path.html`) — no build step, no framework, no bundler. Keep it that way; don't introduce a frontend framework or bundler without explicit instruction.
*   **Infrastructure:**
    - Single container, single image: `Dockerfile` builds a `node:18-alpine` image containing `jira-proxy-server.js` + `jira-critical-path.html`. `GET /` returns the HTML client (served via `res.sendFile`, not `express.static`, so no other file in the working directory is exposed); `POST /api/*` and `GET /health` are the proxy API on the same port (3000).
    - `docker-compose.yml` runs that single `jira-analyzer` service (port 3000, `/health`-gated healthcheck, `./logs:/app/logs` bind mount). Container/service name and port 3000 are load-bearing — do not rename or reorder without checking `SETUP.md` for references.
    - A prior two-container split (`Dockerfile.jira-proxy` + `nginx.conf`, proxy and frontend as separate services) has been replaced by the single-image setup above — those two files no longer exist in this repo.
*   **Automation & Data:**
    - The proxy server is a thin pass-through to the JIRA Cloud REST API v3 (Basic Auth via HTTPS, using email + API token), solely to work around browser CORS restrictions. It does not cache or transform JIRA data beyond what's needed to serve the client. One deliberate exception: completed runs are auto-exported to CSV and written to `logs/` (see `/api/save-export` below) so a finished analysis always leaves an artifact on disk.
    - Known endpoints: `POST /api/jira-search`, `POST /api/jira-metadata`, `POST /api/validate-credentials`, `POST /api/save-export`, `GET /health`. Preserve this contract — the HTML client depends on these exact routes and payload shapes (see `SETUP.md` API Reference section).
    - No database, message queue, or persistent data store is present in this project.
*   **Dependencies:**
    - Declared runtime dependencies (`package.json`): `express`, `cors`, `axios`. Do not add new npm packages unless the task genuinely cannot be done with these plus Node's built-ins, and check both proxy server files first since functionality may already exist in one but not the other.
    - The frontend must remain dependency-free (no npm install, no CDN framework) unless explicitly requested — it is intentionally a single portable HTML file.

## 6. Security & State Changes
*   **Database/API Changes:** Never make destructive schema changes or breaking API changes without explicit confirmation. Check migrations, callers, and compatibility first.
*   **Version Control:** Do not overwrite unrelated user changes. Keep changes focused and atomic. When asked, output exact commit commands (e.g., `git commit -m "..."`) without explanations.
*   **Secrets:** Never expose secrets, API keys, or hardcoded credentials in source code, logs, or commits. Treat security as a first-class concern. JIRA API tokens and credentials are entered by the user in the browser form and passed through the proxy per-request — never log, persist, or hardcode them anywhere in this repo.
