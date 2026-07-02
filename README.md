# AI Software Planning Agent

帮助用户将模糊的软件想法逐步收敛为可执行的软件项目方案。

> Status: Phase 1 — Skeleton (in progress)

## Tech Stack

| 层 | 技术 |
|----|------|
| Monorepo | pnpm workspaces + Turborepo |
| 前端 | Next.js 15 (App Router) |
| 后端 | NestJS 11 |
| 数据库 | PostgreSQL 16 + Prisma 6 |
| 语言 | TypeScript 5.5+ |
| AI 接入 | Baishan OpenAI-compatible API |

## Quick Start

```bash
pnpm install
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:3001/api/v1/health
```

## Project Structure

```
ai-software-planning-agent/
├── apps/
│   ├── api/          # NestJS 11
│   └── web/          # Next.js 15
├── packages/
│   ├── llm-core/         # 核心抽象（接口、类型、适配器）
│   ├── llm-providers/    # Provider 实现（DeepSeek/GLM/MiniMax）
│   ├── llm-orchestrator/ # 编排层（业务代码唯一入口）
│   ├── shared/           # 共享类型/枚举/Schema
│   ├── database/         # Prisma Schema
│   └── config/           # 共享配置
├── specs/                # System Contracts (人读)
├── contracts/            # Machine-readable contracts (OpenAPI + JSON Schema)
└── docs/                 # Project context
```

## Documentation

- 产品定位与 MVP 范围：`docs/product-vision.md`
- 架构与技术栈：`docs/architecture-overview.md`
- 系统契约：`specs/*.spec.md`
- 开发规范：`CLAUDE.md`
