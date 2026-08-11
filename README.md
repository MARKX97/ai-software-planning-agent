# AI Software Planning Agent

帮助用户将模糊的软件想法和已有项目资料逐步收敛为可执行的软件项目方案。用户可以上传文档或导入公开 GitHub 仓库，让 Agent 基于可追溯证据完成需求分析、MVP 取舍、技术方案和规划产物。

本项目是软件规划 Agent，不生成或修改代码。

## 核心能力

- 在需求范围、需求取舍、MVP 范围和技术方案四个检查点与 Agent 实时、多轮讨论。
- 使用 DeepSeek、GLM 和 MiniMax 完成单模型分析、多模型并行分析与结果融合。
- 导入 Markdown、TXT、PDF 和公开 GitHub 仓库，建立项目级知识索引。
- 使用 PostgreSQL 全文检索和 `pgvector` 混合检索项目证据。
- 在 PRD 和 Architecture 中生成 `[S1]` 形式的引用，定位到文档章节、PDF 页码或代码文件、行号和固定 commit。
- 通过 LangGraph 保存执行 checkpoint，在中断或失败后从最近状态恢复。
- 使用固定白名单内的只读 Tool 搜索知识、读取来源、检查仓库和读取已有产物。
- 生成 11 类规划产物，执行确定性质量检查，并在知识变化后只重新生成受影响产物。
- 展示工作流状态、脱敏 Tool 轨迹、模型调用记录、Token 和成本。

## 使用流程

```text
创建项目
  → 上传文档或导入公开 GitHub 仓库
  → 等待知识索引完成
  → 启动规划工作流
  → 完成四个人工检查点
  → 查看和下载带引用的规划产物
  → 知识变化后按影响范围增量重生成
```

支持的知识来源：

| 来源            | 支持范围                                  |
| --------------- | ----------------------------------------- |
| Markdown / TXT  | 单文件最大 20 MiB                         |
| PDF             | 单文件最大 20 MiB；只提取文本，不支持 OCR |
| GitHub 公开仓库 | 固定 commit；不接受私有仓库凭据           |

输出包括 Requirement Report、Feasibility Report、Risk Report、MVP Plan、Platform Recommendation、Project Plan、PRD、Architecture、Frontend Spec、Backend Spec 和 AI Coding Rules。

## Prerequisites（前置依赖 · 本地验证）

本仓库当前**只做本地验证**，不涉及线上/测试环境部署。前置依赖以“本地能跑通单元测试 + 集成测试 + API 契约测试”为目标。数据库迁移、集成测试、API 契约测试和 E2E 需要可用的本地 PostgreSQL 16。

| 工具                      | 用途                                  | 安装命令                          | 验证方式       |
| ------------------------- | ------------------------------------- | --------------------------------- | -------------- |
| Node.js ≥18               | 运行时                                | `brew install node@20` 或官网下载 | `node -v`      |
| pnpm 10                   | 包管理                                | `npm i -g pnpm@10`                | `pnpm -v`      |
| git ≥2.39                 | 版本控制                              | `brew install git`                | `git -v`       |
| curl                      | API 健康检查                          | macOS 自带                        | `curl -V`      |
| jq                        | 解析 JSON 输出                        | `brew install jq`                 | `jq --version` |
| **PostgreSQL 16（本地）** | **数据库迁移、集成、契约与 E2E 测试** | 见下方「安装本地 PostgreSQL」     | `psql -V`      |

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

### 允许构建脚本

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

也可以使用 Docker Compose 启动完整本地 Demo：

```bash
docker compose up --build
# Web: http://localhost:3000
# API: http://localhost:3001/api/v1/health
```

Compose 默认使用 Mock Embedding，并在未配置 `BAISHAN_API_KEY` 时使用 Mock Chat Provider。默认启用知识检索、Graph runner 和受控 Tool；真实模型密钥只传给 API 容器，不会进入 Web 镜像。

### 运行模式

主要开关位于 `.env`：

| 配置                    | 默认值  | 作用                                          |
| ----------------------- | ------- | --------------------------------------------- |
| `RAG_ENABLED`           | `true`  | 启用项目知识检索；关闭后沿用无证据工作流      |
| `WORKFLOW_RUNNER`       | `graph` | 使用可恢复的 LangGraph runner                 |
| `AGENT_ACTIONS_ENABLED` | `true`  | 启用受控只读 Tool；关闭后保留固定知识检索     |
| `EMBEDDING_PROVIDER`    | `mock`  | 默认使用确定性 Mock；可配置独立兼容服务       |
| `BAISHAN_API_KEY`       | 空      | 为空时使用 Mock Chat Provider，配置后调用白山 |

## Tech Stack

| 层         | 技术                                       |
| ---------- | ------------------------------------------ |
| Monorepo   | pnpm workspaces + Turborepo                |
| 前端       | Next.js 15、TanStack Query、Tailwind CSS 4 |
| 后端       | NestJS 11                                  |
| 数据库     | PostgreSQL 16 + pgvector + Prisma 6        |
| Agent 编排 | LangGraph                                  |
| 文档处理   | LangChain loaders / text splitters         |
| AI 接入    | Baishan OpenAI-compatible API              |
| 测试       | node:test、Vitest、Playwright              |
| 语言       | TypeScript 5.5+                            |

用户可见的模型回复由 NestJS API 通过 SSE 代理到浏览器。`BAISHAN_BASE_URL` 与 `BAISHAN_API_KEY` 只配置在 API Server 的 `.env`，不会下发到前端；内部分析与产物生成仍使用结构化非流式调用。

用户可见对话支持 `GLM -> MiniMax -> DeepSeek` 的首字前降级：只有当前模型尚未输出内容时才会切换，避免重复文本。模型工作流操作同时执行 Bearer 认证、单实例限流和持久化项目成本准入；成本达到上限后不再启动新模型调用。

白山接入使用官方 OpenAI-compatible 地址 `https://api.edgefn.net/v1/chat/completions` 和 Bearer Token。模型 ID 区分大小写，`.env.example` 提供的是公开文档可验证的默认值；部署前应在白山控制台核对账号实际可用模型与价格。平台缓存自动生效，项目会记录响应中的 `cached_tokens` 并纳入本地成本估算。

完整接入约束见 [`docs/baishan-integration.md`](docs/baishan-integration.md)。

## 安全与范围边界

- Chat 和 Embedding 密钥只存在 API Server，浏览器不直接访问模型服务。
- 文档、仓库内容和引用文本统一作为不可信上下文，不能改变权限、项目 ID、工作流状态或 Tool 白名单。
- Agent Tool 只能读取当前项目数据，不能修改数据库、代码或工作流状态。
- 当前不支持私有仓库、任意网页抓取、联网搜索、OCR、Multi-Agent、运行时 MCP、Auto Coding 或 Auto Deploy。
- 没有知识源、没有检索结果或关闭知识检索时，工作流仍可完成，并明确标记未使用项目证据。

## Agent 使用说明（Codex / Claude）

本项目采用“一套通用规则 + 工具专用入口”的方式，避免 Codex 和 Claude Code 各维护一份规范导致漂移。

| 文件/目录               | 用途                                             |
| ----------------------- | ------------------------------------------------ |
| `AGENTS.md`             | 通用 agent 规则唯一来源；Codex 直接识别并使用    |
| `CLAUDE.md`             | Claude Code 自动识别入口；内容只指向 `AGENTS.md` |
| `docs/README.md`        | Codex、Claude 和开发者共用的知识地图             |
| `docs/playbooks/`       | 通用开发、测试、LLM 和部署流程                   |
| `.claude/skills/`       | Claude 薄入口；正文统一指向 `docs/playbooks/`    |
| `.claude/settings.json` | Claude 项目级配置                                |

使用原则：

- 修改长期有效的项目规范时，更新 `AGENTS.md` 指向的权威文档。
- 不要在 `CLAUDE.md` 里复制完整规则，避免和 `AGENTS.md` 冲突。
- `.claude/settings.local.json` 属于个人本机授权/状态，不作为团队规范来源。

## 测试策略（本地验证用什么测试）

不是 E2E 单一方案，而是**分层金字塔**（通用要求见 `docs/playbooks/testing.md`）。根据改动范围选择对应测试层，完整验证由这些层共同组成：

```
        ┌───────┐
        │  E2E  │  ← Playwright 用户主流程
        ├───────┤
        │  API  │  ← OpenAPI 契约与 HTTP 集成测试
        ├───────┤
        │  Int  │  ← node:test + 真实 PostgreSQL
        ├───────┤
        │ Unit  │  ← node:test / Vitest
        └───────┘
```

| 层               | 适用范围                       | 需要数据库           | 需要运行中的服务      |
| ---------------- | ------------------------------ | -------------------- | --------------------- |
| Unit 单元        | 函数、组件和局部业务逻辑       | ❌                   | ❌                    |
| Integration 集成 | 数据库、Repository 和模块协作  | ✅ 真本地 PostgreSQL | ❌                    |
| API 契约         | OpenAPI operation 与 HTTP 行为 | ✅                   | 启动 Nest 即可        |
| **E2E**          | 完整用户主流程                 | ✅                   | ✅ 需同时起 API + Web |

本地验证只需要一个 PostgreSQL 实例，不需要部署到线上或测试环境。具体命令与分层门禁以 `docs/playbooks/testing.md` 为准。

### Playwright 浏览器

```bash
pnpm --filter @ai-planning/web exec playwright install
```

### Baishan API Key（可选）

单元测试和集成测试都用 `MockLLMProvider`，**不需要真实 API Key**。只有本地手动跑一遍端到端真实工作流时，才需要在 `.env` 里填 `BAISHAN_BASE_URL` 和 `BAISHAN_API_KEY`。

验证真实 Baishan SSE 时，先在 `.env` 配置上述两项，再显式运行付费测试。该测试默认跳过，不进入 CI：

```bash
RUN_REAL_BAISHAN_STREAM=1 pnpm exec dotenv -e .env -- pnpm --filter @ai-planning/llm-core test
```

本地体验完整流程时，将 `BAISHAN_API_KEY` 留空。系统会使用一套连贯且固定分片输出的演示数据：先通过多轮需求澄清收集信息，再依次停在需求范围、需求取舍、MVP 范围和技术方案四个检查点。每个检查点都可继续与 Agent 实时讨论；点击“确认，继续下一环节”后才会进入后续分析，最终生成 11 类产物和用量日志。

## Project Structure

```
ai-software-planning-agent/
├── AGENTS.md             # Codex/Claude 通用 agent 规则
├── CLAUDE.md             # Claude Code 入口，指向 AGENTS.md
├── .claude/              # Claude 专用 settings/skills
├── apps/
│   ├── api/          # NestJS 11
│   └── web/          # Next.js 15
├── packages/
│   ├── llm-core/         # 核心抽象（接口、类型、适配器）
│   ├── llm-providers/    # Provider 实现（DeepSeek/GLM/MiniMax）
│   ├── llm-orchestrator/ # 编排层（业务代码唯一入口）
│   ├── shared/           # 共享类型/枚举/Schema
│   ├── database/         # Prisma Schema 与 pgvector 检索 Repository
│   └── config/           # 共享配置
├── specs/                # System Contracts (人读)
├── contracts/            # Machine-readable contracts (OpenAPI + JSON Schema)
└── docs/                 # 知识地图、playbook、执行计划和项目上下文
```

## Documentation

- 统一知识地图：`docs/README.md`
- 产品定位与 MVP 范围：`docs/product-vision.md`
- 架构与技术栈：`docs/architecture-overview.md`
- 系统契约：`specs/*.spec.md`
- 通用 agent 开发规范：`AGENTS.md`
- Claude Code 入口：`CLAUDE.md`
- 通用开发流程：`docs/playbooks/development.md`

## Harness Commands

```bash
pnpm harness:check
pnpm verify:fast
pnpm verify
pnpm eval
pnpm diagnose:project -- <project-id>
```

`verify:fast` 用于本地和 pre-push；`verify` 是完整静态检查、测试和构建入口。代码形态存量债务采用只能缩小的精确基线，架构、配置、文档和密钥规则没有存量豁免。
