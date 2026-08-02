# Project Knowledge Map

> Status: Current
> Purpose: Codex、Claude Code 和开发者共用的知识入口。

## Source Of Truth

| 主题                       | 权威文档                                                                                                   | 何时读取                 |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------ |
| 跨任务项目记忆             | [`project-memory.md`](./project-memory.md)                                                                 | 每次任务开始             |
| 产品定位、目标用户、MVP    | [`product-vision.md`](./product-vision.md)                                                                 | 需求和范围变更           |
| 架构、目录、依赖方向       | [`architecture-overview.md`](./architecture-overview.md)                                                   | 新模块、跨包修改、Review |
| 系统数据流入口             | [`system-design.md`](./system-design.md)                                                                   | 理解端到端流程           |
| 白山接入                   | [`baishan-integration.md`](./baishan-integration.md)                                                       | 模型、SSE、成本、密钥    |
| API                        | [`api.spec.md`](../specs/api.spec.md), [`openapi.yaml`](../contracts/openapi.yaml)                         | 路由或 DTO 变更          |
| 数据库与 Schema            | [`database.spec.md`](../specs/database.spec.md), [`schema.spec.md`](../specs/schema.spec.md)               | Prisma、共享 Schema      |
| Workflow                   | [`workflow.spec.md`](../specs/workflow.spec.md), [`state-machine.spec.md`](../specs/state-machine.spec.md) | 阶段、状态、检查点       |
| Prompt 与模型路由          | [`prompt.spec.md`](../specs/prompt.spec.md), [`model-routing.spec.md`](../specs/model-routing.spec.md)     | Prompt 或模型选择        |
| Provider 与 Orchestrator   | [`provider.spec.md`](../specs/provider.spec.md), [`orchestrator.spec.md`](../specs/orchestrator.spec.md)   | LLM 基础层               |
| Frontend                   | [`frontend.spec.md`](../specs/frontend.spec.md)                                                            | 页面和交互               |
| V3 项目知识库（Proposed）  | [`knowledge-base.spec.md`](../specs/knowledge-base.spec.md)                                                | 文档、代码、检索与引用   |
| V3 Agent Graph（Proposed） | [`agent-graph.spec.md`](../specs/agent-graph.spec.md)                                                      | LangGraph、Tool 与恢复   |

JSON Schema 位于 [`contracts/schemas/llm/`](../contracts/schemas/llm/)，与 `packages/shared/src/schemas/llm/` 的 Zod Schema 共同约束模型结构化输出。

## Playbooks

- [`development.md`](./playbooks/development.md)：修改顺序、边界和验证。
- [`testing.md`](./playbooks/testing.md)：测试层级、Mock 和评估入口。
- [`llm-development.md`](./playbooks/llm-development.md)：LLM 调用链和新增模型流程。
- [`deployment.md`](./playbooks/deployment.md)：本地运行、CI 和环境变量。

`.claude/skills/` 只负责让 Claude Code 发现这些 playbook，不是通用知识源。

## Project Memory

[`project-memory.md`](./project-memory.md) 只保存经过验证、跨任务仍有价值且不属于正式契约的事实。产品规则、架构约束和行为定义仍以对应 spec、contract 或 playbook 为准；Memory 只保留摘要、证据链接和对后续工作的影响。

Agent 每次开始任务时读取 Active Memory；只有出现可复用的新事实、已知风险或重复踩坑时才更新，禁止写入会话流水、原始日志、密钥、未验证推测和短期任务进度。

## Plans And Debt

- 复杂任务：在 [`exec-plans/active/`](./exec-plans/active/README.md) 创建执行计划。
- V3 RAG / LangGraph：[`v3-rag-agent.md`](./exec-plans/active/v3-rag-agent.md)（Planned，尚未实现）。
- 完成记录：移动到 [`exec-plans/completed/`](./exec-plans/completed/README.md)。
- 临时豁免：登记在 [`tech-debt.md`](./tech-debt.md)，并同步机器基线。

复杂任务是指修改 API、Schema、数据库、架构边界或多个 workspace package。小范围 bug 修复不要求计划文件。

## Drift Rules

- 每个主题只能有一个权威来源，其他文档只链接，不复制长期规则。
- 文档先于代码修改；机器契约与行为 spec 必须一起更新。
- `pnpm harness:check` 校验本地链接、OpenAPI 引用、文档索引和架构边界。
