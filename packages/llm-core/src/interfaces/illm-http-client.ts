import type { LLMRequest, LLMStreamOptions } from '@ai-planning/shared';

/**
 * HTTP transport abstraction over an OpenAI-compatible gateway.
 *
 * Implemented by {@link OpenAICompatibleAdapter} for Baishan. Other gateways
 * (OpenRouter, 硅基流动) can be added without touching the rest of the stack.
 *
 * @internal
 */
export interface ILLMHttpClient {
  /** Unique identifier for diagnostics. */
  readonly name: string;
  /**
   * Send a chat-completion request and return the raw response text plus token
   * usage. Implementations are responsible for HTTP, timeout, and error
   * mapping to the {@link LLMError} hierarchy.
   */
  complete(request: LLMRequest, timeoutMs: number): Promise<LLMHttpClientResult>;
  /** Stream a completion while also returning the aggregated final result. */
  stream(
    request: LLMRequest,
    timeoutMs: number,
    options: Pick<LLMStreamOptions, 'onDelta' | 'signal'>,
  ): Promise<LLMHttpClientResult>;
}

/** Raw result from the HTTP transport before cost calculation. */
export interface LLMHttpClientResult {
  /** Raw text content from the model. */
  readonly content: string;
  /** Token usage reported by the gateway. */
  readonly usage: { inputTokens: number; outputTokens: number };
}
