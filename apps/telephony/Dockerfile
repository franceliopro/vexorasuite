FROM node:26.13.0-alpine AS base
WORKDIR /workspace

FROM base AS dependencies
RUN npm install --global pnpm@12.22.0
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/telephony/package.json ./apps/telephony/package.json
RUN pnpm install --no-frozen-lockfile

FROM dependencies AS build
COPY apps/telephony ./apps/telephony
RUN pnpm --filter @vexorasuite/telephony build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /workspace/apps/telephony
COPY --from=build --chown=node:node /workspace/node_modules /workspace/node_modules
COPY --from=build --chown=node:node /workspace/apps/telephony/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/telephony/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/telephony/package.json ./package.json
USER node
EXPOSE 3002
CMD ["node", "dist/main.js"]
