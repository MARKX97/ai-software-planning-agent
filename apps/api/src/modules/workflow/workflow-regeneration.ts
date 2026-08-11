import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { loadRegenerationImpact } from './artifact-generation/artifact-impact.js';
import { executeWorkflowPipeline, type WorkflowExecutorDeps } from './workflow-executor.js';
import type { WorkflowStatusResponse } from './workflow-response.dto.js';
import { syncProjectBudget } from './workflow-budget.js';
import { retainRegenerationImpact } from './artifact-generation/artifact-regeneration-state.js';

export async function regenerateAffectedArtifacts(
  deps: WorkflowExecutorDeps,
  projectId: string,
): Promise<WorkflowStatusResponse> {
  const project = await deps.projects.findOrFail(projectId);
  const impact = await loadRegenerationImpact(deps.db, projectId);
  if (!impact) throw regenerationConflict('No artifacts require regeneration');
  const conversation = await findWorkflowConversation(deps, projectId);
  if (!conversation) {
    throw AppException.notFound(
      ErrorCode.CONVERSATION_NOT_FOUND,
      'Workflow conversation not found',
    );
  }
  await syncProjectBudget(deps, projectId);
  await retainRegenerationImpact(deps.db, projectId, impact);
  const executionId = await claimRegeneration(deps, projectId);
  const result = await executeWorkflowPipeline(deps, {
    projectId,
    executionId,
    originalIdea: project.original_idea,
    conversationId: conversation.id,
    startStage: WorkflowStage.PLANNING_GENERATION,
    regenerationTargets: impact.affected_artifacts,
  });
  return result.status;
}

function findWorkflowConversation(deps: WorkflowExecutorDeps, projectId: string) {
  return deps.db.client.conversation.findFirst({
    where: {
      project_id: projectId,
      messages: { some: { metadata: { path: ['workflow'], equals: true } } },
    },
    orderBy: { updated_at: 'desc' },
    select: { id: true },
  });
}

async function claimRegeneration(deps: WorkflowExecutorDeps, projectId: string): Promise<string> {
  const execution = await deps.db.client.$transaction(async (tx) => {
    const claimed = await tx.project.updateMany({
      where: {
        id: projectId,
        status: { in: ['completed', 'failed'] },
        current_stage: { in: [WorkflowStage.COMPLETED, WorkflowStage.FAILED] },
      },
      data: {
        status: 'active',
        current_stage: WorkflowStage.PLANNING_GENERATION,
        error_message: null,
        updated_at: new Date(),
      },
    });
    if (claimed.count !== 1) throw regenerationConflict('Workflow is already running');
    return tx.workflowExecution.create({
      data: {
        project_id: projectId,
        stage: WorkflowStage.PLANNING_GENERATION,
        status: 'success',
        started_at: new Date(),
        retry_count: 0,
      },
    });
  });
  return execution.id;
}

function regenerationConflict(message: string): AppException {
  return AppException.conflict(ErrorCode.REGENERATION_NOT_REQUIRED, message);
}
