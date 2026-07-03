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
  /** Baishan API key. Empty → mocks are used instead of real providers. */
  readonly apiKey: string;
  /** Model IDs resolved from env (BAISHAN_MODEL_*). */
  readonly modelIds: Record<LLMProviderName, string>;
  /** Per-project LLM cost ceiling in CNY. */
  readonly costLimitPerProject?: number;
}

/**
 * Build the fully-wired {@link LlmOrchestratorService}.
 *
 * When `apiKey` is empty (dev without a key), three mock providers are
 * registered so the pipeline runs end-to-end without network access. When a
 * key is present, real providers backed by a single shared adapter to Baishan
 * are registered.
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
  if (!config.apiKey) {
    return [
      new MockLLMProvider('deepseek', config.modelIds.deepseek),
      new MockLLMProvider('glm', config.modelIds.glm),
      new MockLLMProvider('minimax', config.modelIds.minimax),
    ];
  }
  const adapter = new OpenAICompatibleAdapter('baishan', config.baseUrl, config.apiKey);
  return [
    new DeepSeekProvider(config.modelIds.deepseek, adapter),
    new GLMProvider(config.modelIds.glm, adapter),
    new MiniMaxProvider(config.modelIds.minimax, adapter),
  ];
}
