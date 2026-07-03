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
        displayName: 'DeepSeek V4 Pro',
        pricing: { inputPer1k: 0.002, outputPer1k: 0.008 },
        maxTokens: 8192,
        capabilities: ['chat', 'structured_output', 'function_calling', 'json_mode'],
        description: 'DeepSeek 最新旗舰模型，擅长推理和代码生成',
      },
      {
        name: 'glm',
        modelId: input.modelIds.glm,
        displayName: 'GLM 5.1',
        pricing: { inputPer1k: 0.001, outputPer1k: 0.001 },
        maxTokens: 4096,
        capabilities: ['chat', 'structured_output', 'function_calling'],
        description: '智谱 AI 最新模型，中英文能力强',
      },
      {
        name: 'minimax',
        modelId: input.modelIds.minimax,
        displayName: 'MiniMax M2.5',
        pricing: { inputPer1k: 0.001, outputPer1k: 0.001 },
        maxTokens: 4096,
        capabilities: ['chat', 'structured_output'],
        description: 'MiniMax 最新模型，性价比高',
      },
    ];
  },
};

export { PROVIDER_CONFIG_FACTORY as createProviderConfigs };
