# LLM Development Playbook

> Status: Current

## Layers

```text
Workflow/Synthesis/Artifact
  -> @ai-planning/llm-orchestrator
  -> @ai-planning/llm-providers
  -> @ai-planning/llm-core OpenAI-compatible adapter
  -> Baishan
```

- `llm-core`：接口、Adapter、SSE parser、错误和 Mock。
- `llm-providers`：Provider 实现、Registry、定价和响应归一化。
- `llm-orchestrator`：重试、降级、预算、追踪和唯一业务入口。
- `shared`：跨层类型、枚举和 Zod Schema。

API 业务代码不得直接 import `llm-core`、`llm-providers` 或 Adapter。允许的 Orchestrator 调用位置由 [`../architecture-overview.md`](../architecture-overview.md) 定义并由 Harness 检查。

## Model Calls

- 用户可见回复使用 `callSingleStream()`，经 NestJS SSE 代理到浏览器。
- 结构化分析和产物使用 `callSingle()`/`callMulti()`。
- 只有完整成功后才持久化助手消息、调用日志、Token 和成本。
- 输出 delta 后不自动重试，避免重复文本；客户端断开必须取消上游请求。

## Changes

- 新增模型：更新 Provider 配置、Orchestrator 注册、共享/Prisma 枚举、model-routing/provider spec 和 `.env.example`。
- 修改 Prompt：只编辑 `apps/api/src/prompts/`，同步 prompt spec 和回归测试。
- 修改结构化输出：同步 JSON Schema、Zod Schema、schema spec 和测试 fixture。
- 修改白山接入：以 [`../baishan-integration.md`](../baishan-integration.md) 为准。

模型 ID 区分大小写。`.env.example` 是示例配置基准，真实可用模型和计费以白山控制台为准。

## Verification

```bash
pnpm --filter @ai-planning/llm-core test
pnpm --filter @ai-planning/llm-providers test
pnpm --filter @ai-planning/llm-orchestrator test
pnpm harness:check
```
