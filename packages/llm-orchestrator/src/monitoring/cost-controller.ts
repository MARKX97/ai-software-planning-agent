import type { CostInfo } from '@ai-planning/shared';

/**
 * Per-project cost tracking and budget enforcement.
 *
 * @internal
 * @see specs/orchestrator.spec.md §5
 */
export interface ProjectCostStats {
  totalCost: number;
  /** 0-1 fraction of the budget consumed. */
  utilization: number;
  /** True once 80% alertThreshold reached. */
  alertTriggered: boolean;
}

/**
 * Tracks cumulative cost per project and raises budget breaches.
 *
 * @internal
 */
export class CostController {
  private readonly spent = new Map<string, number>();

  constructor(
    private readonly maxCostPerProject = 5.0,
    private readonly alertThreshold = 0.8,
  ) {}

  /** Accumulate cost for a project. */
  track(projectId: string, cost: CostInfo): void {
    const current = this.spent.get(projectId) ?? 0;
    this.spent.set(projectId, current + cost.totalCost);
  }

  /** True when the project has exceeded its budget. */
  isOverBudget(projectId: string): boolean {
    return (this.spent.get(projectId) ?? 0) > this.maxCostPerProject;
  }

  /** Stats for one project. */
  getStats(projectId: string): ProjectCostStats {
    const totalCost = this.spent.get(projectId) ?? 0;
    const utilization = this.maxCostPerProject > 0 ? totalCost / this.maxCostPerProject : 0;
    return { totalCost, utilization, alertTriggered: utilization >= this.alertThreshold };
  }

  /** Reset (mainly for tests). */
  reset(): void {
    this.spent.clear();
  }
}
