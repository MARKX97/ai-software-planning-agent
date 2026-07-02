# AI Software Planning Agent — Rules & Strategy

## A. Core Constraints（始终生效）

### A1. MVP First

不做未在 spec/PRD 中定义的功能。自检：没这功能核心流程能跑通？用户明确需要？在 MVP 范围列表中？1 个否→不做。

### A2. Tech Stack

| 允许                                                                                                             | 禁止                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 15, NestJS 11, PostgreSQL 16, Prisma 6, TypeScript 5.5+, Tailwind 4, shadcn/ui, Zod 3, pnpm 9, Turborepo | Redis, Kafka, Elasticsearch, K8s, 微服务, GraphQL, WebSocket, MongoDB, 向量数据库, gRPC, LangChain/LlamaIndex/CrewAI, Prometheus/Grafana |

### A3. LLM 铁律

唯一合法调用链：Stage/Synthesis/Artifact → `LlmOrchestratorService.callSingle()/callMulti()`
❌ Controller 调 LLM ❌ Service 调 LLM（非白名单） ❌ 直接 import Provider/OpenAI SDK/BaishanAdapter

### A4. 目录约束

- 代码只在 `apps/{web,api}/src/`、`packages/{llm-core,llm-providers,llm-orchestrator,shared,database,config}/`
- 类型→`packages/shared/src/types/`，枚举→`packages/shared/src/enums/`，Schema→`packages/shared/src/schemas/`
- Prompt 模板→`apps/api/src/prompts/`，AI 接口→`packages/llm-core/src/`
- ❌ 根目录创建 `/services/`、`/utils/`、`/lib/`，❌ 创建未定义的 packages/

### A5. 代码规范

- 函数 < 50 行，文件 < 200 行，参数 < 4 个，继承深度 < 2 层
- import 使用绝对路径或 `workspace:*`，函数标注返回类型，public 方法 JSDoc
- Prisma 查询 + LLM 调用用 try/catch，表名 snake_case 复数，UUID 主键，TIMESTAMPTZ
- API: `/api/v1/`，RESTful，统一错误 `{ error: { code, message, details } }`
- ❌ `console.log` ❌ `any` ❌ `@ts-ignore` ❌ `eval` ❌ 硬编码配置

### A6. 禁止清单

微服务, Multi-Agent, RAG, MCP, Auto Coding, Auto Deploy, 循环中 await（可并行时）

---

## B. Context Strategy（token 节省）

### B1. 分层加载

- **L1 始终**：本文件（CLAUDE.md）
- **L2 按 Phase**：对应 `specs/` 中的 1-2 个文件 + 按需 `.claude/skills/` skill
- **L3 参考**：`docs/` 首次加载后不再重复读

### B2. 上下文隔离

每次对话只聚焦一个任务。修 Bug 只加载当前文件 + 相关 spec，不加载无关 spec/skill。

### B3. Contract First

实现阶段只读 `specs/`（契约），不反复读 `docs/`（设计文档）。

### B4. 增量优先

修改代码用 Edit，不用 Write 重写整个文件。

### B5. 反发散

不引入新依赖，不重构已有代码（除非明确要求），不添加未在文档定义的功能。

---

## C. Phase 加载表

| Phase | 主题               | 加载 Skill                                                   | 加载 Spec                                                                                                         |
| ----- | ------------------ | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| 1     | Skeleton           | `.claude/skills/development/phase-1-skeleton.md`             | —                                                                                                                 |
| 2     | Database           | `.claude/skills/development/phase-2-database.md`             | `specs/database.spec.md` + `specs/schema.spec.md`                                                                 |
| 3     | API                | `.claude/skills/development/phase-3-api.md`                  | `specs/api.spec.md`                                                                                               |
| 4-6   | LLM                | `.claude/skills/llm-development/SKILL.md`                    | `specs/provider.spec.md` + `specs/orchestrator.spec.md`                                                           |
| 7     | Workflow           | `.claude/skills/development/phase-7-workflow.md`             | `specs/workflow.spec.md` + `specs/state-machine.spec.md` + `specs/model-routing.spec.md` + `specs/prompt.spec.md` |
| 8-9   | Synthesis/Artifact | `.claude/skills/development/phase-8-9-synthesis-artifact.md` | —                                                                                                                 |
| 10    | Frontend           | `.claude/skills/development/phase-10-frontend.md`            | `specs/frontend.spec.md` + `specs/api.spec.md`                                                                    |

> 通用规范始终加载 `.claude/skills/development/SKILL.md`。`docs/` 首次加载后不再重复读。`contracts/` 不加载到 AI Context。

---

## D. Self-Check（每次编码后）

```
□ 新依赖？ □ 绕过 LlmOrchestrator？ □ 新包/目录？ □ MVP 外功能？
□ 禁止技术？ □ 命名规范？ □ 测试？ □ Controller/Service 直接调 LLM？
□ 非白名单 import llm-orchestrator？ □ 过度设计？
```
