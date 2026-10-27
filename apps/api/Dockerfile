FROM node:22-alpine AS base
RUN apk add --no-cache openssl font-dejavu
WORKDIR /workspace

FROM base AS dependencies
ENV COREPACK_HOME=/corepack
RUN corepack enable
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
RUN pnpm install --no-frozen-lockfile

FROM dependencies AS build
COPY apps/api ./apps/api
RUN pnpm --filter @vexorasuite/api build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/apps/api
COPY --from=build --chown=node:node /workspace/node_modules /workspace/node_modules
COPY --from=build --chown=node:node /workspace/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/prisma ./prisma
COPY --from=build --chown=node:node /workspace/apps/api/package.json ./package.json
USER node
EXPOSE 3001
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main.js"]
