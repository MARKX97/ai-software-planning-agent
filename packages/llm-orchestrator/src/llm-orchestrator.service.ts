import type { ILLMProvider } from '@ai-planning/llm-core';
import type { LLMCallOptions, LLMResponse, LLMStreamOptions } from '@ai-planning/shared';
import type { ProviderRegistry } from '@ai-planning/llm-providers';
import { callStreamWithRetry, callWithRetry } from './strategies/retry-strategy.js';
import { AllModelsFailedError } from './errors/all-models-failed.error.js';
import { CallTracker } from './monitoring/call-tracker.js';
import { CostController } from './monitoring/cost-controller.js';

/**
 * Business-code-only entry point for LLM calls.
 *
 * Only Stage / Synthesis / Artifact services may call this per spec §7 — it is
 * surfaced as a NestJS provider so the rest of the stack can inject it.
 *
 * @internal
 * @see specs/orchestrator.spec.md §1
 */
export class LlmOrchestratorService {
  private readonly tracker = new CallTracker();
  private readonly costController: CostController;

  constructor(
    private readonly registry: ProviderRegistry,
    costController = new CostController(),
  ) {
    this.costController = costController;
  }

  /** Single-model call with retry, timeout, and cost tracking. */
  async callSingle(
    providerName: string,
    prompt: string,
    options: LLMCallOptions = {},
  ): Promise<LLMResponse> {
    this.checkBudget(options);
    const provider = this.registry.get(providerName);
    const startedAt = Date.now();
    try {
      const { response, retries } = await callWithRetry(provider, prompt, options);
      return this.finalize(response, provider, retries, options);
    } catch (error) {
      this.recordFailure(provider, startedAt);
      throw error;
    }
  }

  /** Single-model streamed call with safe pre-delta retry and cost tracking. */
  async callSingleStream(
    providerName: string,
    prompt: string,
    options: LLMStreamOptions,
  ): Promise<LLMResponse> {
    this.checkBudget(options);
    const provider = this.registry.get(providerName);
    const startedAt = Date.now();
    try {
      const { response, retries } = await callStreamWithRetry(provider, prompt, options);
      return this.finalize(response, provider, retries, options);
    } catch (error) {
      this.recordFailure(provider, startedAt);
      throw error;
    }
  }

  /** Parallel call to all providers; partial failure → null entries. */
  async callMulti(
    prompt: string,
    options: LLMCallOptions = {},
  ): Promise<Record<string, LLMResponse | null>> {
    this.checkBudget(options);
    const providers = this.registry.getAll();
    const results = await Promise.all(
      providers.map(async (p) => {
        const startedAt = Date.now();
        try {
          const { response, retries } = await callWithRetry(p, prompt, options);
          return [p.name, this.finalize(response, p, retries, options)] as const;
        } catch {
          this.recordFailure(p, startedAt);
          return [p.name, null] as const;
        }
      }),
    );
    const map = Object.fromEntries(results) as Record<string, LLMResponse | null>;
    const okCount = results.filter(([, r]) => r !== null).length;
    if (okCount === 0) {
      throw new AllModelsFailedError(
        'All models failed in callMulti',
        Object.fromEntries(providers.map((p) => [p.name, 'failed'])),
      );
    }
    return map;
  }

  /** Try providers in priority order; first success wins. */
  async callWithFallback(
    providerNames: string[],
    prompt: string,
    options: LLMCallOptions = {},
  ): Promise<LLMResponse> {
    this.checkBudget(options);
    const failures: Record<string, string> = {};
    for (const name of providerNames) {
      let provider: ILLMProvider;
      try {
        provider = this.registry.get(name);
      } catch (error) {
        failures[name] = error instanceof Error ? error.message : String(error);
        continue;
      }
      const startedAt = Date.now();
      try {
        const { response, retries } = await callWithRetry(provider, prompt, options);
        return this.finalize(response, provider, retries, options);
      } catch (error) {
        this.recordFailure(provider, startedAt);
        failures[name] = error instanceof Error ? error.message : String(error);
      }
    }
    throw new AllModelsFailedError('All models failed in callWithFallback', failures);
  }

  /** Probe all providers. */
  async healthCheck(): Promise<Record<string, boolean>> {
    return this.registry.healthCheckAll();
  }

  /** Aggregate call stats (spec §6). */
  getStats() {
    return this.tracker.getStats();
  }

  /** Per-project cost stats (spec §5). */
  getProjectCost(projectId: string) {
    return this.costController.getStats(projectId);
  }

  private checkBudget(options: LLMCallOptions): void {
    if (options.projectId && this.costController.isOverBudget(options.projectId)) {
      throw new Error(`Cost limit exceeded for project ${options.projectId}`);
    }
  }

  private finalize(
    response: LLMResponse,
    provider: ILLMProvider,
    retries: number,
    options: LLMCallOptions,
  ): LLMResponse {
    const enriched = { ...response, retries };
    this.tracker.record({
      provider: provider.name,
      latencyMs: response.latencyMs,
      totalTokens: response.usage.totalTokens,
      cost: response.cost,
      success: true,
    });
    if (options.projectId) this.costController.track(options.projectId, response.cost);
    return enriched;
  }

  private recordFailure(provider: ILLMProvider, startedAt: number): void {
    this.tracker.record({
      provider: provider.name,
      latencyMs: Date.now() - startedAt,
      totalTokens: 0,
      cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
      success: false,
    });
  }
}
