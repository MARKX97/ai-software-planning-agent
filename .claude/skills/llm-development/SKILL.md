---
name: llm-development
description: LLM development guide — three-layer AI architecture, provider development, orchestrator, prompt templates, schema validation, Baishan config.
triggers:
  - LLM
  - AI orchestrator
  - provider
  - prompt template
  - llm-core
  - llm-providers
  - llm-orchestrator
  - Baishan
  - model call
  - schema validation
  - deepseek
  - glm
  - minimax
---

# LLM Development Guide

> Load: Phase 4-6

## 1. AI 三层架构

```
L1: packages/llm-core/          核心抽象层
    ├── interfaces/              ILLMProvider, ILLMHttpClient, IRetryPolicy
    ├── shared types             packages/shared/src/types/llm.ts
    ├── adapters/                OpenAICompatibleAdapter (连接 Baishan)
    ├── utils/                   calculateCost, validateSchema, createRetryPolicy
    └── errors/                  LLMTimeoutError, LLMRateLimitError, LLMAuthError

L2: packages/llm-providers/     Provider 实现层
    ├── providers/               BaseProvider + DeepSeekProvider + GLMProvider + MiniMaxProvider
    ├── registry/                ProviderRegistry
    └── config/                  ProviderConfigFactory

L3: packages/llm-orchestrator/  编排层（业务唯一入口）
    ├── llm-orchestrator.service.ts  callSingle/callMulti/callWithFallback
    ├── strategies/                  重试/降级/熔断
    └── monitoring/                  CallTracker + CostController
```

## 2. 开发顺序

### Phase 4: LLM Core

1. 创建 packages/llm-core/ 包
2. 定义接口: ILLMProvider, ILLMHttpClient, IRetryPolicy
3. 在 `packages/shared/src/types/llm.ts` 定义 LLMResponse、LLMCallOptions 等共享类型
4. 实现适配器: OpenAICompatibleAdapter
5. 实现工具: calculateCost, validateSchema (Zod 3), createRetryPolicy, parseStructuredOutput
6. 实现错误: LLMTimeoutError, LLMRateLimitError, LLMAuthError, LLMSchemaValidationError

验收: `pnpm --filter llm-core test`

### Phase 5: Provider Layer

1. 创建 packages/llm-providers/ 包
2. BaseProvider（chat() 通用流程: 构建请求→调用适配器→解析响应→计算成本→Schema 校验）
3. 3 个 Provider（各 ~10 行）
4. ProviderRegistry（register/get/getAll/list/healthCheckAll）
5. ProviderConfigFactory

验收: `pnpm --filter llm-providers test`

### Phase 6: AI Orchestrator

1. 创建 packages/llm-orchestrator/ 包
2. 重试策略（指数退避: 1s→2s→4s，最多 3 次）
3. 降级策略（部分失败继续，全失败抛异常）
4. 超时控制（Adapter AbortController，默认 60s）
5. LlmOrchestratorService（callSingle/callMulti/callWithFallback）
6. CallTracker + CostController（80% 告警）
7. 在 `apps/api/src/llm/orchestrator.module.ts` 中初始化

验收: `pnpm --filter llm-orchestrator test`

## 3. Prompt 开发规范

存放位置: `apps/api/src/prompts/<name>.prompt.ts`

```typescript
export const REQUIREMENT_ANALYSIS_PROMPT = `
你是一位资深软件需求分析师。

## 任务
分析以下软件项目想法。

## 项目想法
{{idea}}

## 对话历史
{{conversationHistory}}

## 输出要求
严格按照 JSON Schema 格式输出。
`;
```

变量注入:

```typescript
const prompt = REQUIREMENT_ANALYSIS_PROMPT.replace('{{idea}}', project.originalIdea).replace(
  '{{conversationHistory}}',
  conversationText,
);
```

## 4. Schema 校验流程

```
LLM 返回 JSON
  → parseStructuredOutput(content)
  → validateSchema(parsed, schema)
  → 校验通过: structuredOutput = parsed
  → 校验失败: structuredOutput = null（不抛异常，降级）
```

## 5. 新增 Provider 流程

```
1. 创建 providers/<name>.provider.ts（继承 BaseProvider，~10 行）
2. 在 config/provider-config.factory.ts 添加环境变量
3. 在 llm-orchestrator factory 中注册到 ProviderRegistry
4. 更新 `packages/shared` 与 Prisma 中的 LLMProvider 枚举

无需修改: llm-core, llm-orchestrator, 业务代码
```

## 6. 新增 API Gateway 流程

```
1. 在 .env 添加新 Gateway 的环境变量
2. 创建新的 OpenAICompatibleAdapter 实例
3. 使用新 adapter 创建 Provider 并注册

无需修改: llm-core 接口, llm-orchestrator 代码, 业务代码
```

## 7. Baishan 配置

```bash
BAISHAN_BASE_URL=https://api.baishan.com/v1
BAISHAN_API_KEY=sk-xxx
BAISHAN_MODEL_DEEPSEEK=deepseek-v4-pro
BAISHAN_MODEL_GLM=glm-5.1
BAISHAN_MODEL_MINIMAX=minimax-m2.5
```

## 8. 未来扩展

新增 API Gateway（OpenRouter, 硅基流动等）只需: 添加环境变量 + 创建 Adapter 实例 + 注册 Provider。新增模型只需: 创建 Provider 文件（~10 行）+ 注册。任何 Gateway 或模型变更均不需要修改业务代码。

## 9. 调试技巧

1. 使用 MockLLMProvider 替代真实 Provider
2. CallTracker.getStats() 查看调用统计
3. CostController.getStats() 查看成本统计
4. model_execution_logs 表获取完整调用日志

## 10. 常见问题

**Q: 如何切换模型？**
A: 在阶段处理器中修改 `callSingle('deepseek', ...)` 的第一个参数。

**Q: 如何添加新模型？**
A: 创建 Provider 文件 + 注册到 Registry，不需要修改业务代码。

**Q: 如何调试 Prompt？**
A: 查看 model_execution_logs 表中的 prompt_text 和 response_text。

**Q: 如何控制成本？**
A: 调整 CostController 的 maxCostPerProject 参数，或修改模型路由策略。
