import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ModelPricing } from '@ai-planning/shared';
import { BaseProvider } from './base.provider.js';

/**
 * MiniMax provider with the 0–512K Baishan model-market pricing tier.
 *
 * @internal
 */
export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';
  constructor(
    modelId: string,
    httpClient: ILLMHttpClient,
    pricing: ModelPricing = { inputPer1k: 0.0021, outputPer1k: 0.0084, cachedInputPer1k: 0.00042 },
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
