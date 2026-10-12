# syntax=docker/dockerfile:1
# Multi-stage build: install, build the standalone Next.js server, then copy only what runs.

FROM node:24-alpine AS deps
WORKDIR /app
# .npmrc carries the supply-chain settings (no install scripts, no git deps, week-old releases only)
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 # The doctor as one plain JS file, so it runs in the final image without TypeScript tooling
 && npx esbuild scripts/doctor.ts --bundle --platform=node --format=cjs --log-level=warning --outfile=dist/doctor.cjs

FROM node:24-alpine AS run
WORKDIR /app
# The server only needs node: drop the package managers the base image ships (less to patch,
# fewer findings in image scanners)
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    # node:sqlite still prints an "experimental" warning on every start; it works fine
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/sample-data ./sample-data
COPY --from=build /app/branding ./branding
COPY --from=build /app/config.yml ./config.yml
COPY --from=build /app/dist/doctor.cjs ./scripts/doctor.cjs
# Runs as the image's unprivileged "node" user (uid 1000). The files above stay owned by root, so
# the server can read but not change them. For SQLite, the database file must be readable by this
# user; see docs/DEPLOYING.md.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
