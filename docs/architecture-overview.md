# Architecture Overview

> Version: 1.0.0
> Status: Architecture Source of Truth

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

## 设计约束

- 单体架构，不允许微服务
- 仅 Workflow Agent，不支持 Multi-Agent
- 不引入 RAG、MCP
- 不引入 Redis、Kafka、Elasticsearch、Kubernetes

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

API 中只有以下位置可以 import `LlmOrchestratorService`：

- `apps/api/src/llm/`：应用组装。
- `apps/api/src/health/` 和 `apps/api/src/modules/models/`：仅调用 `healthCheck()`。
- `apps/api/src/modules/workflow/`：模型调用、工作流、融合和产物生成。

Controller、其他 API 模块和 Web 不得访问 Orchestrator、Provider 或 Adapter。上述边界由 `pnpm harness:check` 强制执行。
