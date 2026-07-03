import type { CostInfo } from '@ai-planning/shared';

/**
 * Per-provider call stats tracked by {@link CallTracker}.
 *
 * @internal
 */
export interface ProviderStats {
  calls: number;
  success: number;
  failed: number;
}

/**
 * Aggregate call statistics tracked by {@link CallTracker}.
 *
 * @internal
 * @see specs/orchestrator.spec.md §6
 */
export interface CallStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  totalTokens: number;
  totalCost: number;
  avgLatencyMs: number;
  byProvider: Record<string, ProviderStats>;
}

/** Single recorded call entry. */
export interface CallRecord {
  provider: string;
  latencyMs: number;
  totalTokens: number;
  cost: CostInfo;
  success: boolean;
}

/**
 * In-memory call statistics aggregator. Uses running counters so `getStats()`
 * is O(1) and memory is bounded regardless of call volume. Persisting to
 * `model_execution_logs` happens in a later phase where project/stage context
 * is available.
 *
 * @internal
 */
export class CallTracker {
  private totalCalls = 0;
  private successCalls = 0;
  private totalTokens = 0;
  private totalCost = 0;
  private totalLatencyMs = 0;
  private readonly byProvider: Record<string, ProviderStats> = {};

  /** Record one call result. */
  record(entry: CallRecord): void {
    this.totalCalls += 1;
    if (entry.success) this.successCalls += 1;
    this.totalTokens += entry.totalTokens;
    this.totalCost += entry.cost.totalCost;
    this.totalLatencyMs += entry.latencyMs;
    const p = (this.byProvider[entry.provider] ??= { calls: 0, success: 0, failed: 0 });
    p.calls += 1;
    if (entry.success) p.success += 1;
    else p.failed += 1;
  }

  /** Aggregate stats (spec §6). */
  getStats(): CallStats {
    return {
      totalCalls: this.totalCalls,
      successCalls: this.successCalls,
      failedCalls: this.totalCalls - this.successCalls,
      successRate: this.totalCalls ? this.successCalls / this.totalCalls : 0,
      totalTokens: this.totalTokens,
      totalCost: this.totalCost,
      avgLatencyMs: this.totalCalls ? Math.round(this.totalLatencyMs / this.totalCalls) : 0,
      byProvider: this.byProvider,
    };
  }
}
