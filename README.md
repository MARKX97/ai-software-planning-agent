# AI Software Planning Agent

帮助用户将模糊的软件想法逐步收敛为可执行的软件项目方案。

> Status: Phase 1 — Skeleton (complete) → Phase 2 next

## Prerequisites（前置依赖）

自动化验证不中断的前提是本地装齐以下工具。**Phase 2 起必须有可用的 PostgreSQL 16**。

| 工具 | 用途 | 安装命令 | 验证方式 |
|------|------|----------|----------|
| Node.js ≥18 | 运行时 | `brew install node@20` 或官网下载 | `node -v` |
| pnpm ≥9 | 包管理 | `npm i -g pnpm@10` | `pnpm -v` |
| git ≥2.39 | 版本控制 | `brew install git` | `git -v` |
| curl | API 健康检查 | macOS 自带 | `curl -V` |
| jq | 解析 JSON 输出 | `brew install jq` | `jq --version` |
| **PostgreSQL 16** | **数据库（Phase 2+）** | 见下方「数据库二选一」 | `psql -V` 或 `docker ps` |
| Docker Desktop | 容器化数据库（可选） | `brew install --cask docker` | `docker info` |

### 数据库二选一（Phase 2 起）

**方案 A（推荐，与项目部署文档一致）**：Docker Desktop 跑 PostgreSQL 容器。

```bash
# 安装 Docker Desktop 并启动一次（macOS / Apple Silicon）
brew install --cask docker
open -a Docker          # 启动后等 Docker Desktop 菜单栏图标变绿

# 后续在 Phase 2 会创建 docker/docker-compose.dev.yml，届时：
# docker compose -f docker/docker-compose.dev.yml up -d postgres
```

**方案 B（轻量，无需 Docker）**：Homebrew 直接装 PostgreSQL。

```bash
brew install postgresql@16
brew services start postgresql@16
# 此时默认有本地 postgres 用户，DATABASE_URL 改为：
# postgresql://postgres@localhost:5432/ai_planning_agent?schema=public
```

> ⚠️ 方案 B 会偏离 `docs/` 与 `.claude/skills/deployment/SKILL.md` 里基于 Docker 的部署约定，未来加 `docker-compose.dev.yml` 时需额外适配。

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
pnpm approve-builds   # 见上方说明

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env：
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ai_planning_agent?schema=public
#   BAISHAN_API_KEY=sk-xxx   ← Phase 4+ 才用到，留空可先跳过真实 LLM 调用

# 3. 启动数据库（Phase 2 起）
# 方案 A：docker compose -f docker/docker-compose.dev.yml up -d postgres
# 方案 B：brew services start postgresql@16

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

## Phase 依赖的验证工具

每个 Phase 的自动化验证依赖不同工具。下表说明缺哪个工具会让哪个阶段的验证中断：

| Phase | 主题 | 验证命令 | 依赖的工具 | 缺失时的影响 |
|------|------|----------|-----------|-------------|
| 1 | Skeleton | `curl localhost:3001/api/v1/health` | Node, pnpm, curl | API 起不来 |
| 2 | Database | `pnpm db:migrate && pnpm db:seed` | **PostgreSQL 16**, `pnpm approve-builds` | **迁移失败** |
| 3 | API | `pnpm test`（集成测试） | PostgreSQL 16 | 集成测试失败 |
| 4-6 | LLM Core/Providers/Orchestrator | `pnpm --filter llm-* test` | 仅 Node + pnpm（MockLLMProvider） | 可正常跑，无需真实 API Key |
| 7 | Workflow | `pnpm test` | PostgreSQL + MockLLMProvider | 集成测试失败 |
| 8-9 | Synthesis & Artifact | `pnpm test` | PostgreSQL + MockLLMProvider | 集成测试失败 |
| 10 | Frontend | `pnpm test:e2e` | Node + Playwright 浏览器 + 运行中的 API | E2E 失败 |

### Phase 10 额外：Playwright 浏览器

```bash
# 在 apps/web 下安装浏览器二进制（首次）
pnpm --filter @ai-planning/web exec playwright install
# 或项目根目录加 playwright 后：
# pnpm exec playwright install
```

### Phase 4+：Baishan API Key（可选）

单元测试和集成测试都用 `MockLLMProvider`，**不需要真实 API Key**。只有当你想跑端到端真实工作流时，才需要在 `.env` 里填 `BAISHAN_BASE_URL` 和 `BAISHAN_API_KEY`。

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
