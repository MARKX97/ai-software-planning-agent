import { OpenAICompatibleAdapter, MockLLMProvider, type ILLMProvider } from '@ai-planning/llm-core';
import {
  ProviderRegistry,
  DeepSeekProvider,
  GLMProvider,
  MiniMaxProvider,
} from '@ai-planning/llm-providers';
import type { LLMProviderName } from '@ai-planning/shared';
import { LlmOrchestratorService } from './llm-orchestrator.service.js';
import { CostController } from './monitoring/cost-controller.js';

/**
 * Configuration required to construct the orchestrator.
 *
 * @internal
 */
export interface LlmOrchestratorConfig {
  /** Baishan OpenAI-compatible base URL. */
  readonly baseUrl: string;
  /** Baishan API keys by provider. All empty → mocks are used instead. */
  readonly apiKeys: Record<LLMProviderName, string>;
  /** Model IDs resolved from env (BAISHAN_MODEL_*). */
  readonly modelIds: Record<LLMProviderName, string>;
  /** Per-project LLM cost ceiling in CNY. */
  readonly costLimitPerProject?: number;
}

/**
 * Build the fully-wired {@link LlmOrchestratorService}.
 *
 * When all `apiKeys` are empty (dev without keys), three mock providers are
 * registered so the pipeline runs end-to-end without network access. Real
 * mode requires all keys and gives every provider its own Baishan adapter.
 *
 * @internal
 */
export function createLlmOrchestrator(config: LlmOrchestratorConfig): LlmOrchestratorService {
  const registry = new ProviderRegistry();
  const providers = buildProviders(config);
  for (const p of providers) registry.register(p);
  return new LlmOrchestratorService(registry, new CostController(config.costLimitPerProject));
}

function buildProviders(config: LlmOrchestratorConfig): ILLMProvider[] {
  if (Object.values(config.apiKeys).every((key) => !key)) {
    return [
      new MockLLMProvider('deepseek', config.modelIds.deepseek),
      new MockLLMProvider('glm', config.modelIds.glm),
      new MockLLMProvider('minimax', config.modelIds.minimax),
    ];
  }
  if (Object.values(config.apiKeys).some((key) => !key)) {
    throw new Error('All Baishan model API keys are required when real mode is enabled');
  }
  return [
    new DeepSeekProvider(config.modelIds.deepseek, createAdapter(config, 'deepseek')),
    new GLMProvider(config.modelIds.glm, createAdapter(config, 'glm')),
    new MiniMaxProvider(config.modelIds.minimax, createAdapter(config, 'minimax')),
  ];
}

function createAdapter(
  config: LlmOrchestratorConfig,
  provider: LLMProviderName,
): OpenAICompatibleAdapter {
  return new OpenAICompatibleAdapter({
    name: `baishan-${provider}`,
    baseUrl: config.baseUrl,
    apiKey: config.apiKeys[provider],
  });
}
