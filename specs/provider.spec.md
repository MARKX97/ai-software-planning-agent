# LLM Provider Layer — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: AI Infrastructure Lead
> Tokens: ~4,000

---

## 1. ILLMProvider 接口

```typescript
interface ILLMProvider {
  readonly name: string; // 逻辑名称: 'deepseek' | 'glm' | 'minimax'
  readonly modelId: string; // API 模型 ID: 'deepseek-v4-pro' | 'glm-5.1' | 'minimax-m2.5'
  readonly pricing: ModelPricing; // 定价信息
  chat(prompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
  healthCheck(): Promise<boolean>;
}
```

## 2. BaseProvider 通用流程

```
chat() 流程:
  1. 构建 LLMRequest (OpenAI 兼容格式)
  2. 调用 ILLMHttpClient.complete(request)
  3. 解析响应 → LLMResponse
  4. 计算成本 (calculateCost)
  5. Schema 校验 (如果提供 outputSchema)
     - 校验通过: structuredOutput = parsed
     - 校验失败: structuredOutput = null (不抛异常，降级)
```

## 3. 当前 Provider 实现

### 3.1 DeepSeekProvider

| 属性           | 值                 |
| -------------- | ------------------ |
| name           | `deepseek`         |
| modelId        | `deepseek-v4-pro`  |
| pricing.input  | ¥0.002 / 1K tokens |
| pricing.output | ¥0.008 / 1K tokens |

### 3.2 GLMProvider

| 属性           | 值                 |
| -------------- | ------------------ |
| name           | `glm`              |
| modelId        | `glm-5.1`          |
| pricing.input  | ¥0.001 / 1K tokens |
| pricing.output | ¥0.001 / 1K tokens |

### 3.3 MiniMaxProvider

| 属性           | 值                 |
| -------------- | ------------------ |
| name           | `minimax`          |
| modelId        | `minimax-m2.5`     |
| pricing.input  | ¥0.001 / 1K tokens |
| pricing.output | ¥0.001 / 1K tokens |

## 4. ProviderRegistry

```
register(name: string, provider: ILLMProvider): void
get(name: string): ILLMProvider
getAll(): ILLMProvider[]
list(): string[]
healthCheckAll(): Promise<Record<string, boolean>>
```

## 5. Baishan 配置

```bash
BAISHAN_BASE_URL=https://api.baishan.com/v1
BAISHAN_API_KEY=sk-xxx
BAISHAN_MODEL_DEEPSEEK=deepseek-v4-pro
BAISHAN_MODEL_GLM=glm-5.1
BAISHAN_MODEL_MINIMAX=minimax-m2.5
```

## 6. LLMResponse 类型

| 字段               | 类型         | 说明                        |
| ------------------ | ------------ | --------------------------- |
| `provider`         | string       | Provider 逻辑名称           |
| `model`            | string       | 模型 ID                     |
| `content`          | string       | 原始文本                    |
| `structuredOutput` | object\|null | Schema 校验通过的结构化输出 |
| `usage`            | TokenUsage   | Token 用量                  |
| `cost`             | CostInfo     | 成本明细                    |
| `latencyMs`        | number       | 调用延迟                    |
| `retries`          | number       | 重试次数                    |
| `timestamp`        | string       | 调用时间                    |

## 7. LLMCallOptions

| 字段           | 类型   | 默认值 | 说明             |
| -------------- | ------ | ------ | ---------------- |
| `outputSchema` | object | —      | JSON Schema 约束 |
| `temperature`  | number | 0.7    | 温度             |
| `maxTokens`    | number | 4096   | 最大输出 token   |
| `timeout`      | number | 60000  | 超时 (ms)        |

## 8. 新增 Provider 步骤

```
1. 创建 providers/<name>.provider.ts（继承 BaseProvider，~10 行）
2. 添加环境变量 BAISHAN_MODEL_<NAME>
3. 在 main.ts 启动时注册到 ProviderRegistry
4. 更新 LLMProvider 枚举

无需修改: llm-core, llm-orchestrator, 业务代码
```

## 9. 版本兼容

- ILLMProvider 接口不可变
- BaseProvider 通用流程不可变
- 新增 Provider 不影响现有代码
