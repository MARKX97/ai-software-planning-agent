import type { LLMCallOptions, LLMResponse, ModelPricing } from '@ai-planning/shared';

/**
 * A single provider's capabilities and lifecycle, as seen by the orchestrator.
 *
 * Implementations: DeepSeekProvider, GLMProvider, MiniMaxProvider,
 * MockLLMProvider.
 *
 * @internal
 */
export interface ILLMProvider {
  /** Logical name: 'deepseek' | 'glm' | 'minimax'. */
  readonly name: string;
  /** Model ID sent to the gateway (e.g. 'deepseek-v4-pro'). */
  readonly modelId: string;
  /** Pricing info for cost calculation. */
  readonly pricing: ModelPricing;
  /** Invoke chat completion. */
  chat(prompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
  /**
   * Probe gateway reachability. Optional: the registry's `healthCheckAll`
   * returns a configured-provider snapshot without issuing completions, so
   * live probing is deferred to Phase 7 when real providers need it.
   */
  healthCheck?(): Promise<boolean>;
}
