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

## Priority And Dependency Order

P0 先交付“文档进入、证据检索、产物引用”的最小纵向闭环；P1 扩展代码知识并迁移 LangGraph；P2 才启用模型动态选择 Tool。后续优先级不得绕过前一优先级的退出条件。

## P0 — Minimum Evidence Loop

**Purpose:** 先解除架构和机器契约阻塞，以最少来源类型验证 RAG 用户价值；不依赖 LangGraph。

### P0.1 Architecture And Contract Gate

Dependencies: none.

- 更新 Harness 依赖白名单，只放行 P0 所需的 LangChain 和 `pgvector` 能力。
- 先更新 OpenAPI、共享 Zod Schema、数据库 spec 和 Prisma migration，再实现代码。
- 增加来源、文档、Chunk、revision、处理状态和引用快照；启用 `pgvector`。

Acceptance:

- Schema、迁移、契约和 Harness 测试通过；重复来源按 hash 幂等。
- 失败迁移可回滚到无知识库的 V2 数据结构。

Verification: `pnpm harness:check`, database tests, `pnpm typecheck`.

### P0.2 Document Parsing And Indexing

Dependencies: P0.1.

- 首批仅支持 Markdown、TXT；使用 LangChain Loader / Splitter 和独立 Embedding Provider。
- 实现 active revision 原子切换、部分失败 warning、重新索引和删除。
- 默认测试使用固定向量 Mock。

Acceptance:

- Markdown、TXT 得到稳定 Chunk 与 hash；重复索引不产生重复 active revision。
- 索引失败不替换上一版 active revision，不记录原文、Embedding 或密钥日志。

Rollback: 关闭知识源入口；V2 工作流不依赖索引。

Verification: parser/indexer unit tests, PostgreSQL integration tests, `pnpm verify:fast`.

### P0.3 Hybrid Retrieval And Citations

Dependencies: P0.2.

- 实现 `pgvector` + PostgreSQL FTS、RRF 融合和数据库层项目过滤。
- 按固定阶段策略注入证据，生成并验证 `[S1]` 引用。
- 无知识源或无结果时走 V2 降级路径并显示限制。

Acceptance:

- 跨项目隔离、引用一致性、来源删除与历史快照测试通过。
- 检索离线 fixture 的 Recall@8 达到随 fixture 提交的基线。

Rollback: 禁用 RAG feature flag，恢复现有 Prompt 输入。

Verification: retrieval eval, API integration, artifact contract tests, `pnpm eval`.

### P0.4 Minimum Knowledge UI

Dependencies: P0.1-P0.3 API contracts.

- 提供 Markdown/TXT 上传、索引状态、失败重试、删除和产物引用查看。
- 覆盖 loading、empty、error、retry、键盘操作和 `aria-live`。

Acceptance:

- 用户能从上传文档完整流转到打开产物引用；前端不接触 Provider 密钥。

Rollback: 隐藏 V3 知识库入口，不影响 V2 页面。

Verification: Vitest, Testing Library, Playwright, accessibility checks, `pnpm verify`.

### P0 Exit Gate

- 至少一种文档完成“上传 → 索引 → 检索 → 带引用产物”的闭环。
- 没有知识源或关闭 feature flag 时，V2 的 9 阶段、四个检查点和 11 类产物回归通过。
- Harness、机器契约、项目隔离、引用快照和默认零外部费用测试全部通过。

## P1 — Repository Awareness And Recoverable Graph

**Purpose:** 在 P0 证据闭环稳定后扩展来源，并将现有确定性工作流迁移到可恢复的 LangGraph。

### P1.1 PDF And Public Repository Indexing

Dependencies: P0 Exit Gate.

- 增加 PDF 和公开 GitHub 仓库导入，固定解析后的 commit SHA。
- 忽略二进制、依赖、构建产物、锁文件和疑似密钥文件。
- 提取目录、依赖、接口和数据结构证据，支持增量改造与影响范围分析。

Acceptance:

- PDF 与公开仓库产生稳定 Chunk；代码引用可定位到文件、行号和 commit。
- SSRF、符号链接逃逸、来源大小限制和敏感文件隔离测试通过。

Rollback: 关闭对应来源类型，不影响 P0 文档来源。

Verification: parser/indexer fixtures, repository security tests, retrieval eval, `pnpm verify:fast`.

### P1.2 Deterministic LangGraph Workflow

Dependencies: P0 Exit Gate. 可与 P1.1 并行。

- 在引入 LangGraph 依赖前更新对应 Harness 白名单。
- 将现有 9 阶段、固定证据检索和确定性 Edge 映射为 LangGraph Node。
- 使用持久化 checkpointer 和 `graphRunId` 实现 interrupt、resume 和 replay。
- 现有工作流表继续作为用户可见读模型；增加当前节点与脱敏恢复状态。

Acceptance:

- V2 阶段顺序、SSE、四个检查点和 11 类产物回归通过。
- 进程重启可恢复，重复 resume 不产生重复消息、产物、日志或成本。

Rollback: 保留 V2 runner feature flag，迁移期可切回旧执行器。

Verification: graph unit tests, persistence integration, workflow E2E, `pnpm verify`.

### P1 Exit Gate

- 用户能用 PDF 或公开仓库生成可追溯、代码感知的规划产物。
- LangGraph 承载固定工作流并满足 checkpoint 恢复、幂等和 V2 行为兼容。
- P0 与 P1 完成后达到 V3 首次发布条件。

## P2 — Controlled Dynamic Tools And Incremental Regeneration

**Purpose:** 在检索质量和 Graph 恢复稳定后提升复杂项目的自主取证效率，不扩大 Agent 权限。

### P2.1 Controlled Tool Orchestration

Dependencies: P1 Exit Gate.

- 增加 `searchKnowledge`、`readSource`、`inspectRepository` 和 `getArtifact` Tool。
- 实现 Structured Action、白名单、Zod 参数校验、服务端项目 ID 覆盖、3 次上限和审计。
- 增加 Prompt Injection、越权和 Tool 失败降级测试。

Acceptance:

- 非白名单 Tool、伪造项目 ID、路径穿越和第四次调用均被拒绝。
- Tool 失败按规格降级或进入人工检查点，不执行自由文本指令。

Rollback: 关闭 Agent Action，仅保留 P1 固定检索 Graph。

Verification: Tool contract/security tests, Mock Graph Eval, Web E2E.

### P2.2 Trace UI And Incremental Regeneration

Dependencies: P2.1.

- 展示脱敏 Tool 轨迹、检索摘要和 interrupt 原因。
- 根据知识来源与产物关系提示并重新生成受影响阶段，保留未受影响产物。

Acceptance:

- 用户可查看 Tool 轨迹并恢复 Graph；增量重生成不修改未受影响产物。
- Graph 重放继续满足幂等、Tool 次数和成本上限。

Rollback: 隐藏 Tool 轨迹和增量重生成入口，保留 P1 完整流程。

Verification: integration tests, Web E2E, accessibility checks, `pnpm verify`.

### P2 Exit Gate

- 动态 Tool 的权限、次数、输入和审计边界不可绕过。
- 增量重生成、失败恢复、Prompt Injection 和成本控制回归通过。

## Completion Gate

- 所有 Proposed spec 升级为 Contract，并与 OpenAPI、Prisma、Zod 和实现一致。
- Mock Eval、HTTP integration、Web E2E、Harness、完整构建全部通过。
- 真实 Embedding 与白山 smoke test 必须显式启用，不进入默认 CI。
- 完成后将本文件移至 `docs/exec-plans/completed/`，记录实际验证和遗留风险。
