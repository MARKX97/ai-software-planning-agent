# Testing Playbook

> Status: Current

## Layers

| 层级                    | 工具                     | 目标                           |
| ----------------------- | ------------------------ | ------------------------------ |
| Backend unit/contract   | `node:test` + `tsx`      | DTO、状态机、Service、路由契约 |
| Frontend unit/component | Vitest + Testing Library | API client、SSE、交互状态      |
| HTTP integration        | Fetch + PostgreSQL       | 完整 API 与持久化行为          |
| E2E                     | Playwright               | 创建、讨论、推进、产物和成本   |
| LLM                     | Mock Provider            | 默认确定性、无付费调用         |

## Commands

```bash
pnpm eval            # 核心 Agent 行为，Mock 且确定性
pnpm test            # 全部单元/契约测试
pnpm verify          # format、harness、lint、typecheck、test、build
pnpm --filter @ai-planning/web test:e2e # Web 端到端测试
```

每次代码或产品变更都必须执行 Web E2E。测试需要 PostgreSQL、完成迁移的数据库以及运行在 `3001`/`3000` 端口的 API/Web；CI 会自动准备这些条件。

HTTP integration 由 CI 在 PostgreSQL 和运行中 API 上显式启用。

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
