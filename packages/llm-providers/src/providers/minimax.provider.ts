import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ModelPricing } from '@ai-planning/shared';
import { BaseProvider } from './base.provider.js';

/**
 * MiniMax M2.5 provider. Pricing: ¥0.001/1K input, ¥0.001/1K output.
 *
 * @internal
 */
export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';
  constructor(
    modelId: string,
    httpClient: ILLMHttpClient,
    pricing: ModelPricing = { inputPer1k: 0.001, outputPer1k: 0.001 },
  ) {
    super();
    this.modelId = modelId;
    this.httpClient = httpClient;
    this.pricing = pricing;
  }
  readonly modelId: string;
  readonly pricing: ModelPricing;
  protected readonly httpClient: ILLMHttpClient;
}
