import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ModelPricing } from '@ai-planning/shared';
import { BaseProvider } from './base.provider.js';

/**
 * DeepSeek provider with Baishan model-market pricing.
 *
 * @internal
 */
export class DeepSeekProvider extends BaseProvider {
  readonly name = 'deepseek';
  protected override readonly defaultMaxTokens = 8192;
  constructor(
    modelId: string,
    httpClient: ILLMHttpClient,
    pricing: ModelPricing = {
      inputPer1k: 0.003,
      outputPer1k: 0.009,
      cachedInputPer1k: 0.0001,
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
