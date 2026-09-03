FROM node:18-alpine

WORKDIR /app

# Copy package manifests first for better layer caching
COPY package.json package-lock.json ./

# Install dependencies from the lockfile for reproducible builds
RUN npm ci --omit=dev

# Copy the server and the single-file client it serves at GET / — this one image runs
# both the API and the static client, no separate frontend container.
COPY jira-proxy-server.js jira-critical-path.html ./

# node:18-alpine ships a non-root "node" user (uid 1000) — run as that instead of root
# for defense-in-depth. Pre-create logs/ so it's writable by that user even before the
# app's own fs.mkdirSync runs (matters if it's ever started without the logs volume mounted).
RUN mkdir -p logs && chown -R node:node /app
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

EXPOSE 3000

CMD ["node", "jira-proxy-server.js"]
