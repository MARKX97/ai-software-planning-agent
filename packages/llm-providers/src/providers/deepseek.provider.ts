import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ModelPricing } from '@ai-planning/shared';
import { BaseProvider } from './base.provider.js';

/**
 * DeepSeek provider with Baishan's documented reference pricing.
 *
 * @internal
 */
export class DeepSeekProvider extends BaseProvider {
  readonly name = 'deepseek';
  constructor(
    modelId: string,
    httpClient: ILLMHttpClient,
    pricing: ModelPricing = {
      inputPer1k: 0.004,
      outputPer1k: 0.016,
      cachedInputPer1k: 0.0008,
    },
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
