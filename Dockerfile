FROM node:20-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.19.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile

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
