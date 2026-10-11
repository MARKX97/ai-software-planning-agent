import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ModelPricing } from '@ai-planning/shared';
import { BaseProvider } from './base.provider.js';

/**
 * GLM provider with Baishan model-market pricing.
 *
 * @internal
 */
export class GLMProvider extends BaseProvider {
  readonly name = 'glm';
  constructor(
    modelId: string,
    httpClient: ILLMHttpClient,
    pricing: ModelPricing = {
      inputPer1k: 0.008,
      outputPer1k: 0.028,
      cachedInputPer1k: 0.002,
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
