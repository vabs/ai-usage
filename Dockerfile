# syntax=docker/dockerfile:1

# One Dockerfile, three runnable targets: server, worker, and build (used for migrations).
ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
# SQLite lives on a volume mounted here; pre-create it so the volume is owned by `node`.
RUN mkdir -p /data && chown node:node /data

# ---- manifests only, so dependency layers cache across source changes ----
FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
COPY packages/providers/package.json packages/providers/
COPY packages/shared/package.json packages/shared/

# ---- all deps + source, build everything ----
FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

# ---- production deps only ----
FROM manifests AS prod-deps
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ---- shared runtime image ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/ecosystem.config.cjs ./
COPY --from=build /app/apps/web/dist ./apps/web/dist
USER node

FROM runtime AS server
COPY --from=build /app/apps/server/package.json ./apps/server/
COPY --from=build /app/apps/server/dist ./apps/server/dist
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.cjs", "--only", "server"]

FROM runtime AS worker
COPY --from=build /app/apps/worker/package.json ./apps/worker/
COPY --from=build /app/apps/worker/dist ./apps/worker/dist
CMD ["node_modules/.bin/pm2-runtime", "ecosystem.config.cjs", "--only", "worker"]
