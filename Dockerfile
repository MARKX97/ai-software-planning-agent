# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable \
  && corepack prepare pnpm@10.19.0 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/database/package.json ./packages/database/package.json
COPY packages/llm-core/package.json ./packages/llm-core/package.json
COPY packages/llm-orchestrator/package.json ./packages/llm-orchestrator/package.json
COPY packages/llm-providers/package.json ./packages/llm-providers/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @ai-planning/database db:generate

FROM base AS build
RUN pnpm build

FROM build AS api
ENV NODE_ENV=production
ENV API_PORT=3001
EXPOSE 3001
CMD ["sh", "-c", "pnpm --filter @ai-planning/database exec prisma migrate deploy && node apps/api/dist/main.js"]

FROM build AS web
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@ai-planning/web", "start"]
