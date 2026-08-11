# Baishan Integration

> Status: Current - Integration Reference<br>
> Last verified: 2026-07-17<br>
> Scope: 白山 Chat API 端点、认证、SSE、用量和错误映射。

## Endpoint And Authentication

- Base URL：`https://api.edgefn.net/v1`
- Chat 端点：`POST /chat/completions`
- 认证：`Authorization: Bearer <BAISHAN_API_KEY>`
- API Key 只存在于 NestJS API Server 环境，浏览器代码不直接调用白山。
- 模型 ID 区分大小写，通过 `BAISHAN_MODEL_*` 配置。
- `.env.example` 是提交到仓库的配置样例基准。当其中的 Base URL 或模型 ID 与 API 默认值、CI 覆盖值不一致时，`pnpm harness:check` 会失败。

白山官方 LLM API 页面中的 `prompt` 与 `messages`、`/completions` 与 `/chat/completions` 示例并不一致。本项目采用 Quick Start 和流式指南中可执行的形式：向 `/chat/completions` 发送 `messages`。

## Request Contract

Adapter 发送兼容 OpenAI 的 JSON，请求字段包括 `model`、`messages`、`temperature` 和 `max_tokens`。`temperature` 默认使用文档值 `1`，取值范围必须保持在 `0-2`。

面向用户的回复还会发送 `stream: true`，并通过 Fetch 与 `ReadableStream` 读取 POST 响应。EventSource 只支持 GET，因此不在这里使用。解析器支持分段到达的 CRLF/LF SSE frame、空 delta、可选 usage，以及结束标记 `data: [DONE]`。

## Usage And Cost

白山可能返回 `prompt_tokens`、`completion_tokens`、`total_tokens` 和 `cached_tokens`。缓存由服务端自动处理，请求无需增加额外参数。

本地成本估算公式如下：

```text
未缓存输入成本 = (prompt_tokens - cached_tokens) * 输入单价
缓存输入成本   = cached_tokens * 缓存单价
输出成本       = completion_tokens * 输出单价
```

模型没有公开缓存价格时，估算器使用普通输入价格，以免低估成本。公开价格和折扣可能变化，账单与预算决策以白山控制台为准。

## Errors And Retry

| HTTP/状态码    | 错误映射                  | 是否重试     |
| -------------- | ------------------------- | ------------ |
| 400            | `invalid gateway request` | 否           |
| 401/403        | `authentication error`    | 否           |
| 429            | `rate limit`              | 是，指数退避 |
| 5xx/网络错误   | `network error`           | 是           |
| 超时           | `timeout error`           | 是           |
| 调用方主动取消 | `cancelled`               | 否           |

流式请求只能在第一个可见 delta 到达前重试。输出开始后重试会产生重复文本。

## Official References

- [Quick Start](https://ai.baishan.com/docs/docs/quick-start.html)
- [LLM API v2.0](https://ai.baishan.com/docs/docs/llm-api.html)
- [Streaming optimization](https://ai.baishan.com/docs/docs/streaming-optimization.html)
- [Cache billing](https://ai.baishan.com/docs/docs/production/cache-cost.html)
- [Token billing](https://ai.baishan.com/docs/docs/production/token-billing.html)
