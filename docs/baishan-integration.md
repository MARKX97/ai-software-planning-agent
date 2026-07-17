# Baishan Integration

> Last verified: 2026-07-17

## Endpoint And Authentication

- Base URL: `https://api.edgefn.net/v1`
- Chat endpoint: `POST /chat/completions`
- Authentication: `Authorization: Bearer <BAISHAN_API_KEY>`
- The API key exists only in the NestJS API Server environment. Browser code never calls Baishan directly.
- Model IDs are case-sensitive and configured with `BAISHAN_MODEL_*`.

The official LLM API page contains conflicting `prompt`/`messages` and `/completions`/`/chat/completions` examples. This project follows the executable Quick Start and streaming-guide form: `/chat/completions` with `messages`.

## Request Contract

The adapter sends OpenAI-compatible JSON with `model`, `messages`, `temperature`, and `max_tokens`. `temperature` defaults to the documented value `1` and must remain within `0-2`.

For user-visible replies it also sends `stream: true` and reads the POST response with Fetch + `ReadableStream`. EventSource is not used because it only supports GET. The parser accepts fragmented CRLF/LF SSE frames, empty deltas, optional usage, and the terminal `data: [DONE]` marker.

## Usage And Cost

Baishan may return `prompt_tokens`, `completion_tokens`, `total_tokens`, and `cached_tokens`. Cache handling is automatic and requires no extra request parameter.

Local estimated cost is:

```text
uncached input cost = (prompt_tokens - cached_tokens) * input price
cached input cost  = cached_tokens * cached price
output cost        = completion_tokens * output price
```

When a model's cache price is not publicly documented, the estimator uses its normal input price. This is deliberately conservative. Public prices and discounts can change; billing and budget decisions must use the Baishan console as the source of truth.

## Errors And Retry

| HTTP/status  | Mapping                 | Retry                    |
| ------------ | ----------------------- | ------------------------ |
| 400          | invalid gateway request | no                       |
| 401/403      | authentication error    | no                       |
| 429          | rate limit              | yes, exponential backoff |
| 5xx/network  | network error           | yes                      |
| timeout      | timeout error           | yes                      |
| caller abort | cancelled               | no                       |

For streams, retry is allowed only before the first visible delta. Retrying after output starts would duplicate text.

## Official References

- [Quick Start](https://ai.baishan.com/docs/docs/quick-start.html)
- [LLM API v2.0](https://ai.baishan.com/docs/docs/llm-api.html)
- [Streaming optimization](https://ai.baishan.com/docs/docs/streaming-optimization.html)
- [Cache billing](https://ai.baishan.com/docs/docs/production/cache-cost.html)
- [Token billing](https://ai.baishan.com/docs/docs/production/token-billing.html)
