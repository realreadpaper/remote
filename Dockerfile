FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/protocol/package.json packages/protocol/package.json
COPY apps/server/package.json apps/server/package.json

RUN pnpm install --frozen-lockfile --filter @remote/server...

COPY packages/protocol packages/protocol
COPY apps/server apps/server

RUN pnpm --filter @remote/protocol build && pnpm --filter @remote/server build
RUN pnpm prune --prod

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 8787

CMD ["node", "apps/server/dist/index.js"]
