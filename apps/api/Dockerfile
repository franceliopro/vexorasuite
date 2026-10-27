FROM node:22-alpine

ENV COREPACK_HOME=/corepack
WORKDIR /workspace

RUN apk add --no-cache font-dejavu
RUN corepack enable

COPY . .

RUN pnpm install --no-frozen-lockfile
RUN pnpm --filter @vexorasuite/api build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["pnpm", "--filter", "@vexorasuite/api", "start"]

