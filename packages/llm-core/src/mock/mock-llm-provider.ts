import type { LLMCallOptions, LLMResponse, ModelPricing } from '@ai-planning/shared';
import type { ILLMProvider } from '../interfaces/illm-provider.js';
import { calculateCost } from '../utils/calculate-cost.js';
import { validateSchema } from '../utils/parse-structured-output.js';

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
    const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };
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
}

function mockContent(provider: string, prompt: string): string {
  if (prompt.includes('needs_more_clarification')) {
    const needsMore = prompt.includes('(none)');
    return JSON.stringify({
      needs_more_clarification: needsMore,
      clarification_questions: needsMore
        ? [
            {
              question: 'Who is the primary user?',
              context: 'The initial idea does not identify a target user.',
              category: 'user',
            },
          ]
        : [],
    });
  }
  return JSON.stringify({ mock: true, provider, echo: prompt.slice(0, 64) });
}

function safeParse(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
