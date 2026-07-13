# LLM Provider Layer — System Contract

> Version: 1.1.0
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
  chatStream(prompt: string, options: LLMStreamOptions): Promise<LLMResponse>;
  healthCheck?(): Promise<boolean>;
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

`chatStream()` 复用同一响应归一化流程，但通过 `ILLMHttpClient.stream()` 实时触发 `onDelta`，流结束后仍返回聚合后的标准 `LLMResponse`，用于日志、Token 和成本记录。

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
register(provider: ILLMProvider): void
get(name: string): ILLMProvider
getAll(): ILLMProvider[]
list(): string[]
healthCheckAll(): Promise<Record<string, boolean>>
```

`healthCheckAll()` 在 MVP 返回已注册 Provider 的配置就绪状态，不发起会计费的 Completion。

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

| 字段           | 类型      | 默认值 | 说明           |
| -------------- | --------- | ------ | -------------- |
| `outputSchema` | ZodSchema | —      | 结构化输出约束 |
| `temperature`  | number    | 0.7    | 温度           |
| `maxTokens`    | number    | 4096   | 最大输出 token |
| `timeout`      | number    | 60000  | 超时 (ms)      |

`LLMStreamOptions` 在以上字段基础上增加必填 `onDelta(content)` 和可选 `signal: AbortSignal`。

## 8. Baishan SSE Adapter

- 使用原生 `fetch`、`ReadableStream`、`TextDecoder`，不引入 SSE 依赖。
- 请求设置 `stream: true` 与 `stream_options.include_usage: true`。
- 解析器必须处理跨网络 chunk 拆行、CRLF、空 delta、非法 JSON、`[DONE]`、HTTP 错误与取消。
- 最终 usage 必须存在；Provider 用完整文本和 usage 计算成本、延迟并生成 `LLMResponse`。
- Mock Provider 按固定片段输出，保证测试与本地演示可重复。
- 真实 Baishan SSE smoke test 仅在 `RUN_REAL_BAISHAN_STREAM=1` 时运行，会产生实际调用费用；默认 CI 跳过，执行命令见 `README.md`。

## 9. 新增 Provider 步骤

```
1. 创建 providers/<name>.provider.ts（继承 BaseProvider，~10 行）
2. 添加环境变量 BAISHAN_MODEL_<NAME>
3. 在 `llm-orchestrator` factory 中注册到 ProviderRegistry
4. 更新 LLMProvider 枚举

无需修改: llm-core, llm-orchestrator, 业务代码
```

## 10. 版本兼容

- pre-release 阶段新增 Provider 方法时必须同步所有实现和测试替身
- `chat()` 与 `chatStream()` 必须生成相同形状的最终 `LLMResponse`
- 新增 Provider 不影响现有代码
