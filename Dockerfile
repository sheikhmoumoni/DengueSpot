FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN npm install -g pnpm@10.28.2
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages ./packages
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm build

FROM base AS worker
COPY --from=deps /app /app
COPY . .
RUN mkdir -p /data && chown node:node /data
USER node
ENV DATA_DIR=/data
CMD ["pnpm","worker"]

FROM node:24-bookworm-slim AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 DATA_DIR=/data
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /app/apps/web/public ./apps/web/public
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://localhost:3000/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node","apps/web/server.js"]
