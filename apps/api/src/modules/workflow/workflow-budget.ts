import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import type { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';

export interface WorkflowBudgetDeps {
  readonly db: PrismaService;
  readonly orchestrator: LlmOrchestratorService;
}

/** Hydrate process-local tracking and reject new model work at the persisted limit. */
export async function syncProjectBudget(
  deps: WorkflowBudgetDeps,
  projectId: string,
): Promise<void> {
  const usage = await deps.db.client.tokenUsage.findUnique({
    where: { project_id: projectId },
    select: { total_cost: true },
  });
  const totalCost = usage ? Number(usage.total_cost) : 0;
  if (deps.orchestrator.syncProjectCost(projectId, totalCost)) {
    throw AppException.costLimitExceeded();
  }
}
