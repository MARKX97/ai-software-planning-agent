# Testing Playbook

> Status: Current

## Layers

| 层级                    | 工具                                   | 目标                           |
| ----------------------- | -------------------------------------- | ------------------------------ |
| Backend unit/contract   | `node:test` + `tsx`                    | DTO、状态机、Service、路由契约 |
| Frontend unit/component | Vitest + Testing Library               | API client、SSE、交互状态      |
| HTTP integration        | Fetch + PostgreSQL                     | 完整 API 与持久化行为          |
| E2E                     | Playwright                             | 创建、讨论、推进、产物和成本   |
| LLM                     | Mock Provider                          | 默认确定性、无付费调用         |
| V3 Knowledge（Planned） | 固定文档 + Mock Embedding              | 解析、Chunk、检索、隔离与引用  |
| V3 Graph（Planned）     | LangGraph checkpointer + Mock Tool/LLM | 分支、interrupt、恢复与幂等    |

## Commands

```bash
pnpm eval            # 核心 Agent 行为，Mock 且确定性
pnpm test            # 全部单元/契约测试
pnpm verify          # format、harness、lint、typecheck、test、build
pnpm --filter @ai-planning/web test:e2e # Web 端到端测试
```

每次代码或产品变更都必须执行 Web E2E。测试需要 PostgreSQL、完成迁移的数据库以及运行在 `3001`/`3000` 端口的 API/Web；CI 会自动准备这些条件。

HTTP integration 由 CI 在 PostgreSQL 和运行中 API 上显式启用。

## V2 Coverage Contract

当前 V2 的测试完成标准按行为风险判断，不以 100% 行覆盖为目标：

- Service：CRUD、项目归属、分页/筛选、聚合、not found 和降级分支必须有单元测试。
- Workflow：状态转换、检查点、上下文边界、持久化状态、SSE、重试和成本边界必须有确定性测试。
- Security/Config：认证、限流、敏感信息处理、环境变量解析和用户可见错误映射必须有测试。
- Web：API/SSE client、关键状态组件、表单校验、异步 action、error/retry 和下载必须有组件测试或 E2E。
- E2E：至少覆盖导航、项目创建/删除、完整工作流、四个检查点、11 类产物、下载、成本页和 API 失败恢复。

不为 re-export、常量包、Nest 模块声明、纯样式 UI 原子组件、Prisma 生成代码或 Planned V3 创建无行为断言的测试。数据库约束由 Prisma/HTTP integration 验证。

## Canonical Evaluation Fixture

`packages/llm-core/src/mock/mock-demo-content.ts` 是本地评估 fixture。它必须稳定覆盖：

- 多轮需求澄清后进入人工检查点。
- 需求、MVP 和平台方案可多轮讨论并确认推进。
- 结构化阶段输出满足共享 Schema。
- 生成 11 类非空产物并产生 Token/成本记录。
- 确认检查点后生成可恢复的结构化决策快照，后续 Prompt 不包含无关历史会话。
- 产物质量规则可触发且最多触发一次修订，质量报告覆盖 11 类预期产物。
- SSE 超时、取消、首 token 后失败和重试边界。

评估断言业务状态、Schema 和持久化不变量，不断言自然语言逐字一致。

## Paid Smoke Test

真实白山调用默认跳过：

```bash
RUN_REAL_BAISHAN_STREAM=1 pnpm exec dotenv -e .env -- pnpm --filter @ai-planning/llm-core test
```

不得在默认 CI 中打开该开关。

## V3 Knowledge And Agent Graph（Planned）

V3 测试必须继续满足默认确定性、零外部模型费用和项目隔离。真实 Embedding 与真实 Chat 模型只允许通过独立显式 smoke-test 开关运行。

### Fixtures

- 固定 Markdown、TXT、PDF 和公开仓库快照，内容与 commit 不随网络变化。
- 固定 Embedding Mock：相同文本产生相同维度和向量，支持模拟超时、限流、维度错误与部分失败。
- 固定检索问题与相关 Chunk 标注，用于 Recall@8 和引用正确性评测。
- 固定恶意内容：Prompt Injection、路径穿越、伪造项目 ID、疑似密钥和仓库重定向。
- 固定 Graph checkpoint，覆盖四个人工检查点、进程重启、重复 resume 和节点重放。

### Knowledge Unit And Integration

- Loader 拒绝不支持的格式、空文件、超限文件和不匹配 MIME。
- Chunk 在相同输入下保持顺序、边界和 SHA-256 hash 稳定；不得跨文档合并。
- 重复索引幂等，失败 revision 不替换 active revision，部分失败返回 warning。
- 向量与全文检索各自可测试，RRF 融合结果顺序固定且最多返回 8 条。
- 每个向量查询在 SQL 层包含 `project_id` 与 active revision，跨项目 fixture 返回空结果。
- 删除来源后新检索不可命中，已有产物仍保留生成时引用快照。
- 引用正文标记、结构化列表、Chunk 和内容 hash 一一对应。

### Security And Failure Cases

- 知识内容中的系统指令不能改变工具、项目、状态机、模型路由或数据库操作。
- Tool 参数由服务端覆盖 `projectId`；非白名单 Tool、无效 Zod 输入和路径逃逸在执行前失败。
- GitHub 来源只允许 HTTPS `github.com`，拒绝凭据、非允许重定向、符号链接逃逸和疑似密钥文件。
- 解析、Embedding、pgvector 或知识库不可用时返回脱敏错误，不记录原文、向量、密钥或内部栈。
- 无知识源和零检索结果继续运行 V2 Mock 流程，并明确 `insufficient_evidence`。

### Graph Contract And Recovery

- 9 个阶段、4 个检查点、澄清上限和 11 类产物的现有回归继续通过。
- 单阶段前三次 Tool 调用可执行，第四次确定性拒绝并进入生成或人工检查点。
- Action Structured Output 连续校验失败时不得执行自由文本中的 Tool 指令。
- interrupt 后使用相同 `graphRunId` 恢复；过期 checkpoint 返回冲突。
- 同一 checkpoint 重复 resume、节点重放和并行节点部分失败均不重复写消息、产物、日志、Token 或成本。
- 用户取消传播 AbortSignal，Graph Run 标记 `cancelled`，不保存半条助手消息。
- 首个 SSE delta 后失败不得切换 Provider，继续执行现有流式一致性断言。

### Frontend And E2E

- 知识源页面覆盖 loading、empty、processing、ready、warning、failed、deleted 和 retry。
- 上传、公开仓库导入、重新索引和删除均有键盘可达操作和明确确认。
- 产物 `[S1]` 可以打开证据抽屉，来源不可用时仍显示历史快照和状态说明。
- Graph 轨迹展示当前 Node、Tool 次数、检索摘要和 interrupt 原因，不暴露 Prompt、密钥或完整文档。
- RAG feature flag 关闭时，V2 页面、SSE 和工作流 E2E 不变。

### Release Gates

```bash
pnpm harness:check
pnpm verify:fast
pnpm verify
pnpm --filter @ai-planning/web test:e2e
```

V3 每个阶段必须先提交对应契约和最小回归测试。真实 Embedding smoke test 的命令和环境变量在 Provider 确定后写入 deployment playbook；在此之前不得假设白山 Chat API 支持 Embedding。
