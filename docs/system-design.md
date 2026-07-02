# System Design

> Version: 1.0.0
> Status: Current

---

本文档只作为系统设计入口，不承载具体实现细节，避免与 `architecture-overview.md` 和 `specs/*` 重复。

## 权威来源

| 主题                           | 权威文档                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| 产品定位、核心目标、MVP 范围   | `docs/product-vision.md`                                                                 |
| 架构全景、技术栈、设计约束     | `docs/architecture-overview.md`                                                          |
| 工作流阶段、状态转换、降级路径 | `specs/workflow.spec.md` + `specs/state-machine.spec.md`                                 |
| 数据库表结构、约束、索引       | `specs/database.spec.md`                                                                 |
| API 摘要与实现约束             | `specs/api.spec.md`                                                                      |
| API 机器可读契约               | `contracts/openapi.yaml`                                                                 |
| 数据实体与 LLM 输出 Schema     | `specs/schema.spec.md` + `contracts/schemas/llm/*.json`                                  |
| LLM Provider 与 Orchestrator   | `specs/provider.spec.md` + `specs/orchestrator.spec.md`                                  |
| 模型路由与 Prompt 管理         | `specs/model-routing.spec.md` + `specs/prompt.spec.md`                                   |
| Web UI                         | `specs/frontend.spec.md`                                                                 |
| 开发流程、测试、部署           | `skills/development.skill.md` + `skills/testing.skill.md` + `skills/deployment.skill.md` |

## 开发加载规则

开发 Agent 不应从本文档提取实现细节。进入具体 Phase 时，按 `CLAUDE.md` §C Phase 加载表 加载对应 `specs/` 与 `skills/` 文件。
