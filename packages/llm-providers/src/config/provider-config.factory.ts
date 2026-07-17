import type { LLMProviderName } from '@ai-planning/shared';
import type { ProviderConfig } from './provider-config.js';

/**
 * Build a {@link ProviderConfig} from resolved model IDs.
 *
 * @internal
 */
export interface ProviderConfigInput {
  /** Logical name → model id resolved from env (BAISHAN_MODEL_*). */
  readonly modelIds: Record<LLMProviderName, string>;
}

/**
 * Static catalog of provider metadata. Pricing comes from
 * specs/model-routing.spec.md §3 and is fixed per model.
 */
export const PROVIDER_CONFIG_FACTORY = {
  /** Build all three provider configs from a single model-id map. */
  build(input: ProviderConfigInput): ProviderConfig[] {
    return [
      {
        name: 'deepseek',
        modelId: input.modelIds.deepseek,
        displayName: 'DeepSeek R1 0528',
        pricing: { inputPer1k: 0.004, outputPer1k: 0.016, cachedInputPer1k: 0.0008 },
        maxTokens: 8192,
        capabilities: ['chat', 'streaming'],
        description: '白山文档列出的通用推理模型',
      },
      {
        name: 'glm',
        modelId: input.modelIds.glm,
        displayName: 'GLM 4.5',
        pricing: { inputPer1k: 0.002, outputPer1k: 0.006, cachedInputPer1k: 0.0004 },
        maxTokens: 4096,
        capabilities: ['chat', 'streaming'],
        description: '白山文档列出的通用大语言模型',
      },
      {
        name: 'minimax',
        modelId: input.modelIds.minimax,
        displayName: 'MiniMax M2.5',
        pricing: { inputPer1k: 0.0021, outputPer1k: 0.0084 },
        maxTokens: 4096,
        capabilities: ['chat', 'streaming'],
        description: '白山公开活动说明中列出的通用模型',
      },
    ];
  },
};

export { PROVIDER_CONFIG_FACTORY as createProviderConfigs };
