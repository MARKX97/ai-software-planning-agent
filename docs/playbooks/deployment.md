# Deployment And Operations Playbook

> Status: Current
> Last reviewed: 2026-08-12
> Scope: 当前仓库保证原生本地运行、Docker Compose 本地演示和 GitHub Actions 验证；生产监控和自动部署尚未实现。

## Local Runtime

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- Web: `http://localhost:3000`
- API health: `http://localhost:3001/api/v1/health`
- API 默认只监听 `127.0.0.1`；需要对外监听时显式设置 `API_HOST`，且非 loopback 地址必须同时设置非空 `API_KEY`。
- `CORS_ALLOWED_ORIGINS` 是逗号分隔的精确 Origin allowlist，默认只允许本地 Web 的 `localhost:3000` 与 `127.0.0.1:3000`。
- PostgreSQL 16 必须与 `DATABASE_URL` 一致；知识检索使用带 pgvector 0.8.2 的 `pgvector/pgvector:0.8.2-pg16` 镜像。

## Docker Demo

```bash
docker compose up --build
```

- Compose 启动 PostgreSQL 16、API 和 Web；API 在启动前执行 `prisma migrate deploy`。
- Docker 镜像必须在目标 Linux 环境内执行 `prisma generate`，不得复用宿主机生成的 Prisma Engine；基础镜像必须提供 Prisma 运行时所需的 OpenSSL。
- Web: `http://localhost:3000`；API health: `http://localhost:3001/api/v1/health`。
- Compose 内 API 使用 `0.0.0.0` 供 Web 容器访问，并配置固定的本地演示 API Key；Web 构建使用同一公开演示 key。宿主机端口仅绑定 `127.0.0.1`，该配置不得作为生产凭据复用。
- `BAISHAN_API_KEY` 为空时使用确定性 Mock；配置真实密钥时只注入 API 容器。
- `EMBEDDING_PROVIDER` 默认是固定向量 `mock`；真实服务使用 `openai-compatible`，并单独配置 `EMBEDDING_BASE_URL`、`EMBEDDING_API_KEY`、`EMBEDDING_MODEL` 和 `EMBEDDING_DIMENSIONS`。
- `RAG_ENABLED` 默认 `true`；设为 `false` 时跳过知识检索与查询 Embedding，工作流沿用无证据路径。
- `WORKFLOW_RUNNER` 默认 `graph`；设为 `v2` 时使用旧的确定性 runner。Graph checkpoint 与业务库使用同一 `DATABASE_URL`。
- `AGENT_ACTIONS_ENABLED` 默认 `true`；设为 `false` 时跳过动态 Action/Tool，保留固定检索 Graph。
- Compose 是本地演示入口，不代表生产部署方案。

### Dependency Cache

- Dockerfile 先复制根目录与各 workspace 的依赖清单，再执行 `pnpm install`，最后复制源码；普通源码变化不会使依赖层失效。
- BuildKit 使用持久化的 pnpm store cache。依赖清单或 lockfile 变化时仍会重新执行 install，但已下载且未变化的包可从 store 复用。
- 构建日志中的约 894 个包是 pnpm 为整个 monorepo 解析的生产、开发、传递和可选依赖总树，不表示一次功能改动新增了 894 个直接依赖。
- `package.json`、workspace package manifest、`pnpm-lock.yaml`、`pnpm-workspace.yaml` 或基础镜像变化会按预期使依赖层失效。

## Configuration And Secrets

- `.env.example` 只提供空密钥和公开示例值。
- `.env`、`.env.local`、`.claude/settings.local.json` 不得提交。
- `BAISHAN_API_KEY`、`BAISHAN_BASE_URL`、Embedding 地址/密钥和下载密钥只存在 API Server 环境。
- Web 只能读取 `NEXT_PUBLIC_API_BASE_URL` 和可选的 `NEXT_PUBLIC_API_KEY`。
- 浏览器中的 `NEXT_PUBLIC_API_KEY` 不是秘密；生产环境不能仅依赖该共享 key，仍须用网络边界、精确 CORS 和正式身份认证限制访问。
- 日志、诊断输出和测试 artifact 不得包含密钥、完整 Prompt 或完整模型响应。
- `.dockerignore` 必须排除 `.env`、Git 元数据、依赖、构建输出和本地数据，禁止把本机密钥打进镜像。
- `WORKFLOW_RATE_LIMIT_PER_MINUTE` 控制单实例模型工作流的 caller 全局及 caller+project 限流；设为 `0` 仅用于明确关闭本地限流。未配置 API Key 时 caller 只取远端 IP；内存 bucket 达到硬容量后拒绝新 caller，不允许无界增长。
- 真实 Embedding smoke test 必须显式设置 `RUN_REAL_EMBEDDING=1`；默认测试和 CI 使用固定向量 Mock，不产生外部费用。

```bash
RUN_REAL_EMBEDDING=1 pnpm exec dotenv -e .env -- pnpm --filter @ai-planning/api exec tsx --test test/unit/embedding-provider.test.ts
```

## CI

Push/PR 执行：

```text
install -> migrate -> verify -> start API/Web -> HTTP integration -> Playwright
docker build -> compose up -> API/Web smoke -> compose down
```

CI 默认使用 Mock Provider，不调用付费模型。完整命令以 `.github/workflows/test.yml` 为准。

## Diagnostics

```bash
pnpm diagnose:project -- <project-id>
```

命令只读数据库，输出项目状态、最近工作流执行、对话摘要、模型错误和成本聚合；不输出 API Key、完整 Prompt 或完整模型响应。
