---
name: development-phase-1
description: Phase 1 — Project Skeleton, Monorepo setup, health endpoint.
triggers:
  - Phase 1
  - skeleton
  - monorepo
  - project setup
  - health endpoint
---

# Phase 1 — Project Skeleton

## 目标

搭建 Monorepo 骨架（Turborepo + pnpm workspace），创建 health endpoint 验证基础设施。

## 核心交付

1. `pnpm-workspace.yaml` + `turbo.json` + `tsconfig` 基础配置
2. `apps/api/` (NestJS 11) + `apps/web/` (Next.js 15) 骨架
3. `packages/{llm-core,llm-providers,llm-orchestrator,shared,database,config}/` 空包
4. `apps/api` health endpoint: `GET /api/v1/health` → `{"status":"ok"}`
5. ESLint + Prettier 基础配置

## 目录结构

```
ai-planning-agent/
├── apps/
│   ├── web/         # Next.js 15
│   └── api/         # NestJS 11
├── packages/
│   ├── llm-core/         # [L1] 核心抽象
│   ├── llm-providers/    # [L2] Provider 实现
│   ├── llm-orchestrator/ # [L3] 编排层
│   ├── shared/           # 共享类型/枚举/Schema
│   ├── database/         # Prisma Schema
│   └── config/           # 共享配置
├── specs/           # System Contract
├── contracts/       # Machine-Readable
└── docs/            # Project Context
```

## 模块依赖规则

```
apps/api → llm-orchestrator（不直接依赖 llm-core / llm-providers）
apps/web → apps/api (HTTP)
```

## 验收

```bash
pnpm install && pnpm dev
curl localhost:3001/api/v1/health  # {"status":"ok"}
```
