# Deployment And Operations Playbook

> Status: Current
> Scope: 当前仓库只保证本地运行和 GitHub Actions 验证；Docker、生产监控和自动部署尚未实现。

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

## Configuration And Secrets

- `.env.example` 只提供空密钥和公开示例值。
- `.env`、`.env.local`、`.claude/settings.local.json` 不得提交。
- `BAISHAN_API_KEY`、`BAISHAN_BASE_URL` 和下载密钥只存在 API Server 环境。
- Web 只能读取 `NEXT_PUBLIC_API_BASE_URL` 和可选的 `NEXT_PUBLIC_API_KEY`。
- 日志、诊断输出和测试 artifact 不得包含密钥、完整 Prompt 或完整模型响应。

## CI

Push/PR 执行：

```text
install -> migrate -> verify -> start API/Web -> HTTP integration -> Playwright
```

CI 默认使用 Mock Provider，不调用付费模型。完整命令以 `.github/workflows/test.yml` 为准。

## Diagnostics

```bash
pnpm diagnose:project -- <project-id>
```

命令只读数据库，输出项目状态、最近工作流执行、对话摘要、模型错误和成本聚合；不输出 API Key、完整 Prompt 或完整模型响应。
