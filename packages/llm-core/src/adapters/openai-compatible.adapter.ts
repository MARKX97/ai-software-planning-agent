import type { ILLMHttpClient, LLMHttpClientResult } from '../interfaces/illm-http-client.js';
import type { LLMRequest, LLMStreamOptions } from '@ai-planning/shared';
import {
  LLMAuthError,
  LLMCancelledError,
  LLMError,
  LLMNetworkError,
  LLMRateLimitError,
  LLMTimeoutError,
} from '../errors/llm-errors.js';
import { parseOpenAiSse } from './openai-sse-parser.js';

interface RequestOptions {
  readonly timeoutMs: number;
  readonly stream: boolean;
  readonly signal?: AbortSignal;
}

/**
 * OpenAI-compatible HTTP client used by the three providers to talk to Baishan.
 *
 * Implements only the `POST /chat/completions` shape; everything else is left
 * to the gateway. Uses Node's built-in `fetch` — no SDK dependency.
 *
 * @internal
 */
export class OpenAICompatibleAdapter implements ILLMHttpClient {
  readonly name: string;

  constructor(
    name: string,
    baseUrl: string,
    apiKey: string,
    private readonly fetchImpl: typeof globalThis.fetch = globalThis.fetch.bind(globalThis),
  ) {
    this.name = name;
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private readonly baseUrl: string;
  private readonly apiKey: string;

  async complete(request: LLMRequest, timeoutMs: number): Promise<LLMHttpClientResult> {
    return this.request(request, { timeoutMs, stream: false }, (response) =>
      this.parseResponse(response),
    );
  }

  async stream(
    request: LLMRequest,
    timeoutMs: number,
    options: Pick<LLMStreamOptions, 'onDelta' | 'signal'>,
  ): Promise<LLMHttpClientResult> {
    return this.request(request, { timeoutMs, stream: true, signal: options.signal }, (response) =>
      parseOpenAiSse(response, options.onDelta),
    );
  }

  private async request<T>(
    request: LLMRequest,
    options: RequestOptions,
    consume: (response: Response) => Promise<T>,
  ): Promise<T> {
    const controller = new AbortController();
    let callerCancelled = options.signal?.aborted ?? false;
    const cancel = (): void => {
      callerCancelled = true;
      controller.abort();
    };
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (callerCancelled) controller.abort();
    const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 4096,
          ...(options.stream ? { stream: true, stream_options: { include_usage: true } } : {}),
        }),
        signal: controller.signal,
      });
      this.assertResponseOk(response);
      return await consume(response);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (callerCancelled) throw new LLMCancelledError();
        throw new LLMTimeoutError(`Request aborted after ${options.timeoutMs}ms`);
      }
      if (error instanceof LLMError) throw error;
      throw new LLMNetworkError(error instanceof Error ? error.message : 'Network request failed');
    } finally {
      clearTimeout(timeoutId);
      options.signal?.removeEventListener('abort', cancel);
    }
  }

  private async parseResponse(response: Response): Promise<LLMHttpClientResult> {
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new LLMNetworkError('Gateway returned invalid JSON');
    }
    return this.responseBody(data);
  }

  private assertResponseOk(response: Response): void {
    if (response.status === 401 || response.status === 403) {
      throw new LLMAuthError(`Gateway returned ${response.status}`);
    }
    if (response.status === 429) {
      throw new LLMRateLimitError(`Gateway returned 429`);
    }
    if (response.status >= 500) {
      throw new LLMNetworkError(`Gateway returned ${response.status}`);
    }
    if (!response.ok) {
      throw new LLMNetworkError(`Gateway returned ${response.status}`);
    }
  }

  private responseBody(data: unknown): LLMHttpClientResult {
    const body = data as {
      choices?: Array<{ message?: { content?: unknown } }>;
      usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
    };
    const content = body.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new LLMNetworkError('Gateway response missing choices[0].message.content');
    }
    const inputTokens = Number(body.usage?.prompt_tokens ?? 0);
    const outputTokens = Number(body.usage?.completion_tokens ?? 0);
    if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
      throw new LLMNetworkError('Gateway response contains invalid token usage');
    }
    return {
      content,
      usage: {
        inputTokens,
        outputTokens,
      },
    };
  }
}
