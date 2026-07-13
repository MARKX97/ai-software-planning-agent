import type {
  LLMCallOptions,
  LLMRequest,
  LLMResponse,
  LLMStreamOptions,
  ModelPricing,
} from '@ai-planning/shared';
import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ILLMProvider } from '@ai-planning/llm-core';
import { calculateCost } from '@ai-planning/llm-core';
import { parseStructuredOutput, validateSchema } from '@ai-planning/llm-core';
import { DEFAULT_TIMEOUT_MS } from '../config/provider-config.js';

/**
 * Common provider implementation shared by DeepSeek / GLM / MiniMax. Each
 * subclass only contributes name + modelId + pricing + adapter; everything else
 * flows through here.
 *
 * Flow per spec §2:
 *   1. build request → 2. call adapter → 3. parse response →
 *   4. calculate cost → 5. schema validation (degrades to null on failure).
 *
 * @internal
 */
export abstract class BaseProvider implements ILLMProvider {
  abstract readonly name: string;
  abstract readonly modelId: string;
  abstract readonly pricing: ModelPricing;
  protected abstract readonly httpClient: ILLMHttpClient;

  async chat(prompt: string, options?: LLMCallOptions): Promise<LLMResponse> {
    const start = Date.now();
    const timeout = options?.timeout ?? DEFAULT_TIMEOUT_MS;
    const result = await this.httpClient.complete(this.request(prompt, options), timeout);
    return this.response(result, start, options);
  }

  async chatStream(prompt: string, options: LLMStreamOptions): Promise<LLMResponse> {
    const start = Date.now();
    const result = await this.httpClient.stream(
      this.request(prompt, options),
      options.timeout ?? DEFAULT_TIMEOUT_MS,
      options,
    );
    return this.response(result, start, options);
  }

  private request(prompt: string, options?: LLMCallOptions): LLMRequest {
    return {
      model: this.modelId,
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? 0.7,
      maxTokens: options?.maxTokens ?? 4096,
    };
  }

  private response(
    result: Awaited<ReturnType<ILLMHttpClient['complete']>>,
    start: number,
    options?: LLMCallOptions,
  ): LLMResponse {
    const usage = {
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      totalTokens: result.usage.inputTokens + result.usage.outputTokens,
    };
    let structuredOutput: unknown = null;
    try {
      const parsed = parseStructuredOutput(result.content);
      if (options?.outputSchema) {
        const validation = validateSchema(parsed, options.outputSchema);
        structuredOutput = validation.success ? validation.data : null;
      } else {
        structuredOutput = parsed;
      }
    } catch {
      // Non-JSON content degrades to null per spec §2 (no exception thrown).
      structuredOutput = null;
    }
    return {
      provider: this.name,
      model: this.modelId,
      content: result.content,
      structuredOutput,
      usage,
      cost: calculateCost(usage, this.pricing),
      latencyMs: Date.now() - start,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }
}
