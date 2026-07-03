import type { ILLMHttpClient } from '@ai-planning/llm-core';
import type { ModelPricing } from '@ai-planning/shared';
import { BaseProvider } from './base.provider.js';

/**
 * DeepSeek V4 Pro provider. Pricing: ¥0.002/1K input, ¥0.008/1K output.
 *
 * @internal
 */
export class DeepSeekProvider extends BaseProvider {
  readonly name = 'deepseek';
  constructor(
    modelId: string,
    httpClient: ILLMHttpClient,
    pricing: ModelPricing = { inputPer1k: 0.002, outputPer1k: 0.008 },
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
