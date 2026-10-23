FROM node:22-alpine

ENV COREPACK_HOME=/corepack
WORKDIR /workspace

RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @vexorasuite/web build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["pnpm", "--filter", "@vexorasuite/web", "start"]
