# AI Software Planning Agent — Agent Rules

> This file is the single source of truth for agent-facing project rules.
> Codex reads this file directly. Claude Code should enter through `CLAUDE.md`,
> which points back to this file. Tool-specific settings stay in their own
> directories such as `.claude/`.

## 0. Communication

- 默认使用中文交流，保留技术名词、库名、协议名和错误原文。
- 先给简短 plan，再执行代码修改。
- 不确定接口、业务或运行环境时，先说明假设与风险，不猜测实现。
- 如果本文件规则与框架社区惯例或项目现状冲突，先提醒并解释原因。

## 1. Core Constraints

### 1.1 MVP First

不做未在 spec/PRD 中定义的功能。实现前自检：

- 没有这个功能，核心流程是否仍可跑通？
- 用户是否明确需要？
- 是否在 MVP 范围列表中？

任一答案为否时，默认不做。

### 1.2 Tech Stack

| 允许                                                                                                             | 禁止                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js 15, NestJS 11, PostgreSQL 16, Prisma 6, TypeScript 5.5+, Tailwind 4, shadcn/ui, Zod 3, pnpm 9, Turborepo | Redis, Kafka, Elasticsearch, K8s, 微服务, GraphQL, WebSocket, MongoDB, 向量数据库, gRPC, LangChain/LlamaIndex/CrewAI, Prometheus/Grafana |

### 1.3 LLM Call Chain

唯一合法调用链：

```text
Stage/Synthesis/Artifact -> LlmOrchestratorService.callSingle()/callMulti()
```

禁止：

- Controller 直接调 LLM
- 非白名单 Service 直接调 LLM
- 直接 import Provider/OpenAI SDK/BaishanAdapter

### 1.4 Directory Boundaries

- 业务代码只放在 `apps/{web,api}/src/` 和 `packages/{llm-core,llm-providers,llm-orchestrator,shared,database,config}/`。
- 类型放 `packages/shared/src/types/`。
- 枚举放 `packages/shared/src/enums/`。
- Schema 放 `packages/shared/src/schemas/`。
- Prompt 模板放 `apps/api/src/prompts/`。
- AI 接口放 `packages/llm-core/src/`。
- 禁止在根目录创建 `/services/`、`/utils/`、`/lib/`。
- 禁止创建未定义的 packages，除非先更新设计/契约并得到确认。

### 1.5 Code Rules

- 函数 < 50 行，文件 < 200 行，参数 < 4 个，继承深度 < 2 层。
- import 使用绝对路径或 `workspace:*`。
- 函数标注返回类型，public 方法写 JSDoc。
- Prisma 查询和 LLM 调用必须有明确错误处理。
- 数据库表名使用 snake_case 复数，主键 UUID，时间使用 TIMESTAMPTZ。
- API 路径使用 `/api/v1/`，REST/JSON。
- 统一错误结构：`{ error: { code, message, details } }`。
- 禁止 `console.log`、`any`、`@ts-ignore`、`eval`、硬编码配置。

### 1.6 Forbidden Scope

禁止在未明确批准时引入：

- 微服务
- Multi-Agent
- RAG
- MCP
- Auto Coding
- Auto Deploy
- 可并行场景中的循环 `await`

这里的 MCP 禁止项仅指不要把 MCP 作为本项目运行时技术栈引入；不限制 Codex/Claude 等开发工具自身使用 connector/MCP 能力。

## 2. Frontend Rules

- API 调用集中在 `api/` 或 `services/` 层，不散落在组件里。
- 每个接口定义请求类型、响应类型和错误类型。
- UI 必须处理 loading、empty、error 和 retry/降级。
- 默认就近状态，跨页面必需共享时才放 global store。
- 禁止 `dangerouslySetInnerHTML`，除非用户确认且做 sanitize。
- 表单元素必须有 label/aria，可点击元素使用 `button`/`a`。
- 大列表默认分页或虚拟化，优先分页。
- 修 bug 必须补回归用例。

## 3. Backend Rules

- 路由只做 HTTP 绑定，controller 只做 request/response 组装。
- 业务逻辑放 services，I/O 放 repositories/data 或专门 service。
- 所有外部输入必须用 schema validator 校验和白名单化。
- 禁止拼接 SQL/NoSQL 查询字符串，只用参数化查询或 ORM。
- 永远不要把内部异常栈或敏感信息直接返回给前端。
- 重要接口必须维护 OpenAPI/Swagger 注释或等价文档。
- 配置来自环境变量或 config 文件，不硬编码。

## 4. Context Strategy

- 每次对话只聚焦一个任务。
- 修 bug 只加载当前文件和相关 spec，不加载无关 spec/skill。
- 实现阶段优先读 `specs/` 契约，不反复读 `docs/` 设计文档。
- 修改代码使用增量编辑，不为了局部修改重写整个文件。
- 不引入新依赖、不重构已有代码，除非用户明确要求或先确认。

## 5. Phase Loading

| Phase | 主题               | 参考文档                                                                                                                          |
| ----- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Skeleton           | `.claude/skills/development/phase-1-skeleton.md`                                                                                  |
| 2     | Database           | `.claude/skills/development/phase-2-database.md`, `specs/database.spec.md`, `specs/schema.spec.md`                                |
| 3     | API                | `.claude/skills/development/phase-3-api.md`, `specs/api.spec.md`                                                                  |
| 4-6   | LLM                | `.claude/skills/llm-development/SKILL.md`, `specs/provider.spec.md`, `specs/orchestrator.spec.md`                                 |
| 7     | Workflow           | `.claude/skills/development/phase-7-workflow.md`, `specs/workflow.spec.md`, `specs/state-machine.spec.md`, `specs/prompt.spec.md` |
| 8-9   | Synthesis/Artifact | `.claude/skills/development/phase-8-9-synthesis-artifact.md`                                                                      |
| 10    | Frontend           | `.claude/skills/development/phase-10-frontend.md`, `specs/frontend.spec.md`, `specs/api.spec.md`                                  |

`.claude/skills/**` 当前仍是项目 playbook 的存放位置。Claude 可以通过 skills 使用；Codex 需要时直接读取对应 Markdown 文件。

## 6. Verification

常用验证命令：

```bash
pnpm test
pnpm lint
pnpm build
pnpm db:migrate
curl localhost:3001/api/v1/health
```

命令输出原则：

- 默认只保留成功/失败、错误堆栈和最终统计。
- 单条命令输出超过 30 行时，只保留关键错误或末尾摘要。
- 测试通过时只汇总数量；测试失败时列失败用例详情。

## 7. Self-Check

每次编码后检查：

```text
□ 新依赖？ □ 绕过 LlmOrchestrator？ □ 新包/目录？ □ MVP 外功能？
□ 禁止技术？ □ 命名规范？ □ 测试？ □ Controller/Service 直接调 LLM？
□ 非白名单 import llm-orchestrator？ □ 过度设计？
```

## 8. Tool-Specific Notes

- Claude Code: `CLAUDE.md` is the entry file and should point to this file.
- Claude-only skills/settings remain under `.claude/`.
- Codex: this `AGENTS.md` is the project instruction file.
- Do not duplicate long-lived rules across `AGENTS.md` and `CLAUDE.md`; update this file instead.
