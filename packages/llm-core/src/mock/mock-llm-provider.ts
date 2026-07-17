import type {
  LLMCallOptions,
  LLMResponse,
  LLMStreamOptions,
  ModelPricing,
} from '@ai-planning/shared';
import type { ILLMProvider } from '../interfaces/illm-provider.js';
import { calculateCost } from '../utils/calculate-cost.js';
import { validateSchema } from '../utils/parse-structured-output.js';
import { mockContent } from './mock-demo-content.js';
import { LLMCancelledError } from '../errors/llm-errors.js';

/**
 * Deterministic mock provider used when no real Baishan key is configured
 * and in tests. Produces a small JSON-shaped response so the rest of the
 * pipeline can be exercised end-to-end without network access.
 *
 * @internal
 */
export class MockLLMProvider implements ILLMProvider {
  readonly name: string;
  readonly modelId: string;
  readonly pricing: ModelPricing;

  constructor(
    name: string,
    modelId = 'mock-model',
    pricing: ModelPricing = { inputPer1k: 0.001, outputPer1k: 0.001 },
  ) {
    this.name = name;
    this.modelId = modelId;
    this.pricing = pricing;
  }

  async chat(prompt: string, options?: LLMCallOptions): Promise<LLMResponse> {
    const start = Date.now();
    const content = mockContent(this.name, prompt);
    const usage = { inputTokens: 10, outputTokens: 20, cachedTokens: 0, totalTokens: 30 };
    let structuredOutput: unknown = null;
    if (options?.outputSchema) {
      const parsed = safeParse(content);
      const result = validateSchema(parsed, options.outputSchema);
      structuredOutput = result.success ? result.data : null;
    } else {
      structuredOutput = safeParse(content);
    }
    return {
      provider: this.name,
      model: this.modelId,
      content,
      structuredOutput,
      usage,
      cost: calculateCost(usage, this.pricing),
      latencyMs: Date.now() - start,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }

  async chatStream(prompt: string, options: LLMStreamOptions): Promise<LLMResponse> {
    if (options.signal?.aborted) throw new LLMCancelledError();
    const response = await this.chat(prompt, options);
    for (const chunk of response.content.match(/.{1,12}/gs) ?? []) {
      if (options.signal?.aborted) throw new LLMCancelledError();
      await options.onDelta(chunk);
    }
    return response;
  }
}

function safeParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
