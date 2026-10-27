FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /workspace

FROM base AS dependencies
ENV COREPACK_HOME=/corepack
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --no-frozen-lockfile

FROM dependencies AS build
COPY apps/web ./apps/web
RUN mkdir -p apps/web/public
RUN pnpm --filter @vexorasuite/web build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /workspace/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
