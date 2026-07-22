# Deployment And Operations Playbook

> Status: Current
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
- PostgreSQL 16 必须与 `DATABASE_URL` 一致。

## Docker Demo

```bash
docker compose up --build
```

- Compose 启动 PostgreSQL 16、API 和 Web；API 在启动前执行 `prisma migrate deploy`。
- Docker 镜像必须在目标 Linux 环境内执行 `prisma generate`，不得复用宿主机生成的 Prisma Engine；基础镜像必须提供 Prisma 运行时所需的 OpenSSL。
- Web: `http://localhost:3000`；API health: `http://localhost:3001/api/v1/health`。
- `BAISHAN_API_KEY` 为空时使用确定性 Mock；配置真实密钥时只注入 API 容器。
- Compose 是本地演示入口，不代表生产部署方案。

## Configuration And Secrets

- `.env.example` 只提供空密钥和公开示例值。
- `.env`、`.env.local`、`.claude/settings.local.json` 不得提交。
- `BAISHAN_API_KEY`、`BAISHAN_BASE_URL` 和下载密钥只存在 API Server 环境。
- Web 只能读取 `NEXT_PUBLIC_API_BASE_URL` 和可选的 `NEXT_PUBLIC_API_KEY`。
- 日志、诊断输出和测试 artifact 不得包含密钥、完整 Prompt 或完整模型响应。
- `.dockerignore` 必须排除 `.env`、Git 元数据、依赖、构建输出和本地数据，禁止把本机密钥打进镜像。
- `WORKFLOW_RATE_LIMIT_PER_MINUTE` 控制单实例模型工作流限流；设为 `0` 仅用于明确关闭本地限流。

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
