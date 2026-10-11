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
 * specs/model-routing.spec.md §3 and is fixed per configured context tier.
 */
export const PROVIDER_CONFIG_FACTORY = {
  /** Build all three provider configs from a single model-id map. */
  build(input: ProviderConfigInput): ProviderConfig[] {
    return [
      {
        name: 'deepseek',
        modelId: input.modelIds.deepseek,
        displayName: 'DeepSeek V4 Flash 0731',
        pricing: { inputPer1k: 0.003, outputPer1k: 0.009, cachedInputPer1k: 0.0001 },
        maxTokens: 8192,
        capabilities: ['chat', 'streaming'],
        description: '白山模型市场中的稀疏混合专家模型',
      },
      {
        name: 'glm',
        modelId: input.modelIds.glm,
        displayName: 'GLM 5.2',
        pricing: { inputPer1k: 0.008, outputPer1k: 0.028, cachedInputPer1k: 0.002 },
        maxTokens: 4096,
        capabilities: ['chat', 'streaming'],
        description: '白山模型市场中的旗舰大模型',
      },
      {
        name: 'minimax',
        modelId: input.modelIds.minimax,
        displayName: 'MiniMax M3',
        pricing: { inputPer1k: 0.0021, outputPer1k: 0.0084, cachedInputPer1k: 0.00042 },
        maxTokens: 4096,
        capabilities: ['chat', 'streaming'],
        description: '白山模型市场中的多模态基础模型（0–512K 上下文档）',
      },
    ];
  },
};

export { PROVIDER_CONFIG_FACTORY as createProviderConfigs };
