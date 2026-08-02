# V3 RAG And LangGraph

> Status: Planned
> Product Scope: `docs/product-vision.md#v3基于项目证据的受控规划-agentplanned`
> Contracts: `specs/knowledge-base.spec.md`, `specs/agent-graph.spec.md`

## Goal

在不破坏 V2 工作流、人工检查点和 Orchestrator 边界的前提下，引入项目知识库、证据引用和单 Agent 受控 Graph 编排。

## Non-Goals

- Multi-Agent、Supervisor、运行时 MCP 和无限制反思。
- 网页搜索、任意 URL 抓取、私有仓库授权和自动修改代码。
- 独立向量数据库、微服务或新的消息队列。

## Rule Changes Approved For V3

- 允许按规格引入 LangChain、LangGraph 和 PostgreSQL `pgvector`。
- Chat LLM 仍只通过 `LlmOrchestratorService` 调用。
- 向量相似度查询允许在数据库包单一 Repository 中使用参数化 Raw SQL。
- RAG 内容属于不可信上下文；Tool 必须白名单、Zod 校验、限次和审计。

## Phases

### 1. Knowledge Contracts And Storage

Dependencies: none.

- 先更新 OpenAPI、共享 Zod Schema、数据库 spec 和 Prisma migration。
- 增加来源、文档、Chunk、revision 和处理状态；启用 `pgvector`。
- 增加文件与公开 GitHub 来源的输入验证和项目隔离。

Acceptance:

- Schema、迁移和契约测试通过；重复来源按 hash 幂等。
- 失败迁移可回滚到无知识库的 V2 数据结构。

Verification: `pnpm harness:check`, database tests, `pnpm typecheck`.

### 2. Parsing And Indexing

Dependencies: Phase 1.

- 使用 LangChain Loader / Splitter 和独立 Embedding Provider。
- 实现 active revision 原子切换、部分失败 warning 和重新索引。
- 默认测试使用固定向量 Mock。

Acceptance:

- Markdown、TXT、PDF 和公开仓库得到稳定 Chunk 与 hash。
- 索引失败不替换上一版 active revision，不记录原文或密钥日志。

Rollback: 关闭知识源入口；V2 工作流不依赖索引。

Verification: parser/indexer unit tests, PostgreSQL integration tests, `pnpm verify:fast`.

### 3. Hybrid Retrieval And Citations

Dependencies: Phase 2.

- 实现 pgvector + PostgreSQL FTS、RRF 融合和项目级过滤。
- 将证据注入阶段 Prompt，生成并验证 `[S1]` 引用。
- 无知识源或无结果时走 V2 降级路径并显示限制。

Acceptance:

- 跨项目隔离、引用一致性、来源删除与历史快照测试通过。
- 检索离线 fixture 的 Recall@8 达到评测基线后才进入下一阶段；基线在实现时随 fixture 一起提交。

Rollback: 禁用 RAG feature flag，恢复现有 Prompt 输入。

Verification: retrieval eval, API integration, artifact contract tests, `pnpm eval`.

### 4. LangGraph Workflow

Dependencies: Phase 3.

- 将现有 9 阶段映射为 LangGraph Node 和确定性 Edge。
- 使用持久化 checkpointer 和 `graphRunId` 实现 interrupt、resume 和 replay。
- 现有工作流表继续作为用户可见读模型。

Acceptance:

- V2 阶段顺序、SSE、四个检查点和 11 类产物回归通过。
- 重启恢复与重复 resume 不产生重复消息、产物或成本。

Rollback: 保留 V2 runner feature flag，迁移期可切回旧执行器。

Verification: graph unit tests, persistence integration, workflow E2E, `pnpm verify`.

### 5. Controlled Tool Orchestration

Dependencies: Phase 4.

- 增加知识检索、来源读取、仓库检查和前序产物 Tool。
- 实现 Structured Action、白名单、Zod 参数校验、3 次上限和审计。
- 增加 Prompt Injection 与越权测试。

Acceptance:

- 非白名单 Tool、伪造项目 ID、路径穿越和第四次调用均被拒绝。
- Tool 失败按规格降级或进入人工检查点，不执行自由文本指令。

Rollback: 关闭 Agent Action，仅保留固定 2-Step RAG。

Verification: Tool contract/security tests, Mock Graph Eval, Web E2E.

### 6. Web Knowledge And Evidence UI

Dependencies: Phases 1-5 的 API 契约。

- 增加知识源管理、索引状态、错误重试和检索预览。
- 增加产物证据抽屉、Graph 轨迹和受影响产物重新生成入口。
- 覆盖 loading、empty、error、retry、键盘操作和 `aria-live`。

Acceptance:

- 用户能完成上传/仓库导入、查看状态、打开引用和恢复 Graph。
- 前端不接触 Embedding 或 Chat Provider 密钥。

Rollback: 隐藏 V3 导航入口，不影响 V2 页面。

Verification: Vitest, Testing Library, Playwright, accessibility checks, `pnpm verify`.

## Completion Gate

- 所有 Proposed spec 升级为 Contract，并与 OpenAPI、Prisma、Zod 和实现一致。
- Mock Eval、HTTP integration、Web E2E、Harness、完整构建全部通过。
- 真实 Embedding 与白山 smoke test 必须显式启用，不进入默认 CI。
- 完成后将本文件移至 `docs/exec-plans/completed/`，记录实际验证和遗留风险。
