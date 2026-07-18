# AI Orchestrator — System Contract

> Version: 1.1.0
> Status: Contract
> Owner: AI Infrastructure Lead
> Tokens: ~4,000

---

## 1. LlmOrchestratorService — 业务代码唯一 LLM 入口

### 1.1 callSingle

```
callSingle(providerName: string, prompt: string, options?: LLMCallOptions): Promise<LLMResponse>
```

单模型调用。内置: 重试（指数退避）+ AbortController 超时 + Schema 校验 + Token 追踪。

### 1.2 callMulti

```
callMulti(prompt: string, options?: LLMCallOptions): Promise<Record<string, LLMResponse | null>>
```

并行调用所有已注册 Provider。部分失败返回 null，全失败抛 AllModelsFailedError。

### 1.3 callSingleStream

```typescript
callSingleStream(
  providerName: string,
  prompt: string,
  options: LLMStreamOptions,
): Promise<LLMResponse>
```

单模型流式调用。继续执行预算检查、CallTracker、成本聚合和统一错误映射；`onDelta` 只负责向调用方传递增量文本。

### 1.4 callWithFallback

```
callWithFallback(providerNames: string[], prompt: string, options?: LLMCallOptions): Promise<LLMResponse>
```

按优先级依次尝试，第一个成功即返回。

### 1.5 healthCheck

```
healthCheck(): Promise<Record<string, boolean>>
```

检查所有 Provider 的配置就绪状态；MVP 不通过 Completion 做计费式探活。

### 1.6 callSingleStreamWithFallback

```typescript
callSingleStreamWithFallback(
  providerNames: string[],
  prompt: string,
  options: LLMFallbackStreamOptions,
): Promise<LLMResponse>
```

按顺序尝试流式 Provider。只有失败 Provider 尚未输出任何 delta 时才允许继续下一个 Provider；输出开始后的失败、调用方取消和所有 Provider 失败都直接结束当前流。`onProviderFailure` 为 Workflow 提供脱敏审计信息，不允许在 Orchestrator 中访问数据库。

## 2. 重试策略

| 错误类型                 | 是否重试 | 重试次数 | 延迟         |
| ------------------------ | -------- | -------- | ------------ |
| LLMTimeoutError          | ✅       | 3        | 1s → 2s → 4s |
| LLMRateLimitError        | ✅       | 3        | 1s → 2s → 4s |
| 网络错误                 | ✅       | 3        | 1s → 2s → 4s |
| LLMAuthError             | ❌       | 0        | —            |
| LLMSchemaValidationError | ❌       | 0        | —            |

流式调用只允许在第一个 delta 之前自动重试。任意文本已经输出后不得自动重试，避免客户端收到重复内容。`AbortSignal` 取消不重试；Orchestrator 只记录 CallTracker 失败统计，Workflow 层负责将对应 `workflow_execution` 标记为 `cancelled`。

## 3. 超时策略

| 阶段                      | 超时 |
| ------------------------- | ---- |
| requirement_analysis      | 60s  |
| requirement_clarification | 60s  |
| multi_model_analysis      | 90s  |
| requirement_synthesis     | 60s  |
| feasibility_analysis      | 60s  |
| risk_analysis             | 60s  |
| mvp_compression           | 60s  |
| platform_recommendation   | 60s  |
| planning_generation       | 120s |

## 4. 降级策略

```
callMulti:
  3/3 成功 → 正常
  2/3 成功 → 降级（WARNING）
  1/3 成功 → 严重降级（WARNING）
  0/3 成功 → AllModelsFailedError

callWithFallback:
  依次尝试 providerNames，第一个成功即返回
  全失败 → AllModelsFailedError

callSingleStreamWithFallback:
  首个 delta 前失败 → 记录失败并尝试下一个 Provider
  首个 delta 后失败 → 不切换，向调用方传播原错误
  调用方取消 → 不切换
  全部失败 → AllModelsFailedError
```

## 5. 成本控制

Provider 成本包含白山自动缓存：普通输入、缓存输入和输出分别计价后汇总。若模型没有公开缓存单价，按普通输入单价保守估算；预算控制使用本地估算值，实际账单以白山控制台为准。

| 参数              | 默认值 | 说明           |
| ----------------- | ------ | -------------- |
| maxCostPerProject | ¥5.00  | 单项目预算上限 |
| alertThreshold    | 80%    | 告警比例       |

Workflow 在每次用户操作开始前从 `token_usage` 读取持久化成本，并通过 `syncProjectCost(projectId, totalCost)` 同步到 Orchestrator。Orchestrator 在本轮执行中继续累加已完成调用；持久化读取仍由 API 层负责，禁止 Orchestrator 依赖数据库。

## 6. CallTracker

记录每次调用: provider, latency, tokens, cost, success/fail。

```
getStats(): {
  totalCalls, successCalls, failedCalls, successRate,
  totalTokens, totalCost, avgLatencyMs,
  byProvider: Record<string, { calls, success, failed }>
}
```

流式调用完整结束后向 CallTracker 写入成功调用、Token 与成本；若白山流未返回 usage，则按 0 Token、0 成本记录成功，不丢弃已完成回复。取消或失败按 0 Token、0 成本写入失败统计。数据库 execution 与模型调用日志由 Workflow 层负责。

## 7. 依赖约束

```
apps/api 只依赖 llm-orchestrator
不依赖 llm-core 和 llm-providers

业务代码只能通过 LlmOrchestratorService 调用 LLM
禁止直接 import Provider 或 OpenAI SDK
```

## 8. 白名单

允许调用 Orchestrator 的模块:

| 模块            | 文件                                                   |
| --------------- | ------------------------------------------------------ |
| Workflow Stages | `modules/workflow/stages/*.stage.ts`                   |
| Synthesis       | `modules/synthesis/requirement-synthesizer.service.ts` |
| Artifact        | `modules/artifact/artifact-generator.service.ts`       |
| Health          | `health/health.service.ts`（仅配置就绪检查）           |
| Models          | `modules/models/models.service.ts`（仅模型目录状态）   |

禁止调用 Orchestrator 的模块:

- modules/project/
- modules/conversation/
- modules/files/
- modules/cost/
- common/
- config/
