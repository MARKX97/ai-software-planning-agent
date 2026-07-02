# AI Software Planning Agent

帮助用户将模糊的软件想法逐步收敛为可执行的软件项目方案。

> Status: Phase 1 — Skeleton (complete) → Phase 2 next

## Prerequisites（前置依赖 · 本地验证）

本仓库当前**只做本地验证**，不涉及线上/测试环境部署。前置依赖以"本地能跑通单元测试 + 集成测试 + API 契约测试"为目标。**Phase 2 起必须有可用的本地 PostgreSQL 16**。

| 工具 | 用途 | 安装命令 | 验证方式 |
|------|------|----------|----------|
| Node.js ≥18 | 运行时 | `brew install node@20` 或官网下载 | `node -v` |
| pnpm ≥9 | 包管理 | `npm i -g pnpm@10` | `pnpm -v` |
| git ≥2.39 | 版本控制 | `brew install git` | `git -v` |
| curl | API 健康检查 | macOS 自带 | `curl -V` |
| jq | 解析 JSON 输出 | `brew install jq` | `jq --version` |
| **PostgreSQL 16（本地）** | **数据库（Phase 2+ 集成/契约测试）** | 见下方「安装本地 PostgreSQL」 | `psql -V` |

### 安装本地 PostgreSQL 16（推荐：Homebrew，最省事）

本地验证只用一个能连上的 PostgreSQL 实例就够，不需要容器编排：

```bash
brew install postgresql@16
brew services start postgresql@16   # 开机自启 + 立即启动

# 验证
psql postgres -c "SELECT version();"
```

`.env` 里 `DATABASE_URL` 用本地连接（默认当前系统用户作为 postgres 角色）：

```
DATABASE_URL=postgresql://@localhost:5432/ai_planning_agent?schema=public
```

> 如果你更喜欢 Docker，也可以用 `docker run -d --name pg -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`，把 `DATABASE_URL` 设为 `postgresql://postgres:postgres@localhost:5432/ai_planning_agent?schema=public`。两边都只是本地实例，与"线上/测试环境"无关。

### 允许构建脚本（Phase 2 起）

`pnpm install` 默认跳过部分包的构建脚本，Prisma 的引擎二进制需要显式批准：

```bash
pnpm approve-builds
# 交互菜单里勾选：@prisma/client、prisma、esbuild、sharp
```

未做这一步，`prisma generate` 会报找不到引擎二进制，导致 `prisma migrate` 失败。

## Setup（首次配置）

```bash
# 1. 安装依赖
pnpm install
pnpm approve-builds

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 的 DATABASE_URL 指向本地 PostgreSQL（见上方）

# 3. 启动本地数据库
brew services start postgresql@16

# 4. 开发
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:3001/api/v1/health
```

## Quick Start

```bash
pnpm install
pnpm dev
# Web: http://localhost:3000
# API: http://localhost:3001/api/v1/health
```

## Tech Stack

| 层 | 技术 |
|----|------|
| Monorepo | pnpm workspaces + Turborepo |
| 前端 | Next.js 15 (App Router) |
| 后端 | NestJS 11 |
| 数据库 | PostgreSQL 16 + Prisma 6 |
| 语言 | TypeScript 5.5+ |
| AI 接入 | Baishan OpenAI-compatible API |

## 测试策略（本地验证用什么测试）

不是 e2e 单一方案，而是**分层金字塔**（见 `.claude/skills/testing/SKILL.md`）。每个 Phase 的本地验证由不同层组合而成：

```
        ┌───────┐
        │  E2E  │  ← ~10 个（Playwright）· 仅 Phase 10
        ├───────┤
        │  API  │  ← 26 个接口契约（Supertest + OpenAPI）
        ├───────┤
        │  Int  │  ← ~20 个集成（Jest + 真实 PostgreSQL）
        ├───────┤
        │ Unit  │  ← 100+ 单元（Jest/Vitest）
        └───────┘
```

| 层 | 何时跑 | 需要数据库 | 需要运行中的服务 |
|----|--------|-----------|-----------------|
| Unit 单元 | 每个 Phase | ❌ | ❌ |
| Integration 集成 | Phase 2/3/7/8-9 | ✅ 真本地 PostgreSQL | ❌ |
| API 契约 | Phase 3+ | ✅ | 启动 Nest 即可 |
| **E2E** | **只有 Phase 10** | ✅ | ✅ 需同时起 API + Web |

→ 前 9 个 Phase 的本地验证**只需一个本地 PostgreSQL**，不需要部署到任何环境。

## 各 Phase 本地验证依赖

| Phase | 主题 | 验证命令 | 依赖的工具 | 缺失时的影响 |
|------|------|----------|-----------|-------------|
| 1 | Skeleton | `curl localhost:3001/api/v1/health` | Node, pnpm, curl | API 起不来 |
| 2 | Database | `pnpm db:migrate && pnpm db:seed` | **本地 PostgreSQL 16**, `pnpm approve-builds` | **迁移失败** |
| 3 | API | `pnpm test`（集成 + 契约） | 本地 PostgreSQL 16 | 集成/契约测试失败 |
| 4-6 | LLM Core/Providers/Orchestrator | `pnpm --filter llm-* test` | 仅 Node + pnpm（MockLLMProvider） | 可正常跑 |
| 7 | Workflow | `pnpm test` | 本地 PostgreSQL + MockLLMProvider | 集成测试失败 |
| 8-9 | Synthesis & Artifact | `pnpm test` | 本地 PostgreSQL + MockLLMProvider | 集成测试失败 |
| 10 | Frontend | `pnpm test:e2e` | Node + Playwright 浏览器 + 运行中的 API + Web | E2E 失败 |

### Phase 10 额外：Playwright 浏览器（届时再装）

```bash
pnpm --filter @ai-planning/web exec playwright install
```

### Phase 4+：Baishan API Key（可选）

单元测试和集成测试都用 `MockLLMProvider`，**不需要真实 API Key**。只有本地手动跑一遍端到端真实工作流时，才需要在 `.env` 里填 `BAISHAN_BASE_URL` 和 `BAISHAN_API_KEY`。

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
- 开发流程：`.claude/skills/development/SKILL.md`
