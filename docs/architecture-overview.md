# Architecture Overview

> Version: 1.2.0
> Status: Current V2 + V3 P0; Proposed P1/P2 Target

---

## 技术栈

| 层       | 技术                          | 版本   |
| -------- | ----------------------------- | ------ |
| 前端     | Next.js (App Router)          | 15.x   |
| 后端     | NestJS                        | 11.x   |
| 数据库   | PostgreSQL                    | 16     |
| ORM      | Prisma                        | 6      |
| 语言     | TypeScript                    | 5.5+   |
| 样式     | Tailwind CSS                  | 4.x    |
| UI       | shadcn/ui                     | latest |
| 包管理   | pnpm                          | 10     |
| Monorepo | Turborepo                     | latest |
| AI 接入  | Baishan OpenAI Compatible API | —      |

## 架构图

```
┌──────────────────────────────────────────────────────────┐
│                  Web UI / HTTP API                        │
├──────────────────────────────────────────────────────────┤
│               API Layer (NestJS 11)                       │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Project     │  │ Conversation │  │  Artifact      │  │
│  │  Controller  │  │  Controller  │  │  Controller    │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬─────────┘  │
├─────────┼─────────────────┼─────────────────┼────────────┤
│         │          Service Layer            │            │
│  ┌──────┴──────────────────┴─────────────────┴─────────┐  │
│  │                 Workflow Engine                      │  │
│  └──────┬──────────────────┬─────────────────┬─────────┘  │
│  ┌──────┴──────┐  ┌────────┴──────┐  ┌──────┴─────────┐  │
│  │  LLM        │  │  Requirement  │  │  Artifact      │  │
│  │  Orchestrator│  │  Synthesizer │  │  Generator     │  │
│  └──────┬──────┘  └───────────────┘  └────────────────┘  │
├─────────┼─────────────────────────────────────────────────┤
│         │            Infrastructure Layer                  │
│  ┌──────┴──────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │  LLM        │  │  PostgreSQL  │  │  File System    │  │
│  │  Providers  │  │  + Prisma 6  │  │  (Artifacts)    │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

## AI 三层架构

```
L1: packages/llm-core/          核心抽象（接口、适配器、错误与工具）
L2: packages/llm-providers/     Provider 实现（DeepSeek/GLM/MiniMax）
L3: packages/llm-orchestrator/  编排层（业务代码唯一入口）
Shared: packages/shared/        跨层 LLM 类型、枚举与 Zod Schema
```

## AI 调用铁律

```
业务代码 → llm-orchestrator → llm-providers → Baishan API

❌ 业务代码直接调用 llm-providers
❌ 业务代码直接调用 llm-core 的 HTTP 客户端
❌ 业务代码直接 import OpenAI SDK
✅ 业务代码只能通过 LlmOrchestratorService 调用
```

## 当前设计约束

- 单体架构，不允许微服务
- 仅 Workflow Agent，不支持 Multi-Agent
- P0 仅使用固定阶段 RAG，不引入运行时 MCP 或动态 Agent Tool
- 不引入 Redis、Kafka、Elasticsearch、Kubernetes

## V3 P0 Current And P1/P2 Target

V3 P0 已在 PostgreSQL 中增加项目知识索引，并由现有 Workflow 在规划生成前执行一次固定检索。P1 才会在 API Workflow 与 Orchestrator 之间增加 Agent Graph。

```text
Browser / SSE
  -> NestJS Workflow Controller
  -> Existing Workflow Executor
       -> Fixed Knowledge Retrieval (P0)
            -> Document Loader / Splitter
            -> Embedding Provider
            -> PostgreSQL 16 + pgvector / Full Text Search
       -> Existing LlmOrchestratorService
            -> Providers -> OpenAI-compatible Adapter -> Baishan
  -> Workflow / knowledge state persisted by Prisma

P1: Workflow Executor -> AgentGraphService (LangGraph checkpoint / resume)
P2: AgentGraphService -> controlled Knowledge Tools
```

### 技术职责

| 技术           | V3 职责                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| LangChain      | P0 文档加载与切片；后续 Retriever/Tool 接口，不负责工作流状态推进          |
| LangGraph      | P1 Graph State、条件边、持久化 checkpoint、人工 interrupt 和受控 Tool 编排 |
| pgvector       | 在现有 PostgreSQL 中保存与检索 Embedding，不新增独立数据库                 |
| PostgreSQL FTS | 精确匹配技术名词、路径和标识符，与向量结果融合                             |

### V3 依赖与调用边界

- `apps/api/src/modules/knowledge/` 负责导入、索引、检索和引用；不得调用 Chat LLM。
- P1 才新增 `apps/api/src/modules/workflow/graph/` 承载 LangGraph State、Node、Edge 和 Tool 编排。
- Graph Node 只能通过 `LlmOrchestratorService` 调用 Chat LLM，不得 import Provider、Adapter 或模型 SDK。
- Embedding 使用独立配置和适配器；密钥只存在 API Server，浏览器只读取处理状态和脱敏错误。
- 普通数据访问继续使用 Prisma；向量相似度查询集中在数据库包的单一 Repository，使用参数化 Raw SQL。
- Graph checkpoint 是执行恢复来源；现有 `workflow_states`、消息和产物继续作为用户可见读模型与审计记录。
- 所有 Graph Node 在 interrupt 前的副作用必须幂等，重放不得重复写消息、产物、Token 或成本。
- 知识内容是 `untrusted-context`，只能作为证据，不得修改权限、路由、工具白名单和确定性状态转换。

### V3 仍禁止

- Multi-Agent、Supervisor、运行时 MCP 和无限制 ReAct 循环。
- 微服务、Redis、Kafka、WebSocket、GraphQL 和独立向量数据库。
- LangGraph 或 LangChain 绕过现有 Orchestrator 直接调用 Chat 模型。

V3 P0 详细行为以 `specs/knowledge-base.spec.md` 为准；`specs/agent-graph.spec.md` 继续表示 P1/P2 目标架构。

## Workspace 依赖矩阵

| Workspace                   | 允许依赖的内部包                                   |
| --------------------------- | -------------------------------------------------- |
| `packages/shared`           | 无                                                 |
| `packages/config`           | 无                                                 |
| `packages/database`         | 无                                                 |
| `packages/llm-core`         | `shared`                                           |
| `packages/llm-providers`    | `llm-core`, `shared`                               |
| `packages/llm-orchestrator` | `llm-core`, `llm-providers`, `shared`              |
| `apps/api`                  | `config`, `database`, `llm-orchestrator`, `shared` |
| `apps/web`                  | 无；通过 HTTP 访问 API                             |

P1 允许 `apps/api` 直接依赖 `@langchain/core`、`@langchain/textsplitters`、`@langchain/langgraph` 和 `@langchain/langgraph-checkpoint-postgres`；其他 workspace 与 Agent 聚合包继续禁止。

API 中只有以下位置可以 import `LlmOrchestratorService`：

- `apps/api/src/llm/`：应用组装。
- `apps/api/src/health/` 和 `apps/api/src/modules/models/`：仅调用 `healthCheck()`。
- `apps/api/src/modules/workflow/`：模型调用、工作流、融合和产物生成。

Controller、其他 API 模块和 Web 不得访问 Orchestrator、Provider 或 Adapter。上述边界由 `pnpm harness:check` 强制执行。
