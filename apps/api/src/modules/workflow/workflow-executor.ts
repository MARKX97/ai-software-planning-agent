import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { WorkflowStage, type WorkflowContext } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  appendCheckpointIntroduction,
  appendClarificationQuestions,
  closeWorkflowConversation,
  loadWorkflowConversationContext,
  openCheckpointConversation,
} from './workflow-conversation.js';
import { loadPersistedStageResults } from './workflow-results.js';
import { runPipeline } from './workflow-pipeline-runner.js';
import type { WorkflowStatusResponse } from './workflow-response.dto.js';
import {
  buildWorkflowStatus,
  markExecutionComplete,
  markFailed,
  markProjectComplete,
} from './workflow-store.js';

export interface WorkflowExecutorDeps {
  readonly db: PrismaService;
  readonly projects: ProjectsService;
  readonly orchestrator: LlmOrchestratorService;
}

export interface WorkflowExecutorInput {
  readonly projectId: string;
  readonly executionId: string;
  readonly originalIdea: string;
  readonly conversationId: string;
  readonly startStage?: WorkflowStage;
}

export async function executeWorkflowPipeline(
  deps: WorkflowExecutorDeps,
  input: WorkflowExecutorInput,
): Promise<WorkflowStatusResponse> {
  const ctx = await buildWorkflowContext(deps.db, input);
  try {
    const finalStage = await runPipeline(
      ctx,
      { db: deps.db, orchestrator: deps.orchestrator },
      { startStage: input.startStage },
    );
    if (finalStage === WorkflowStage.COMPLETED) {
      await Promise.all([
        markProjectComplete(deps.db, input.projectId),
        closeWorkflowConversation(deps.db, input.conversationId),
      ]);
    }
  } catch (error) {
    await markFailed(deps.db, input.projectId, input.executionId, error);
    return buildWorkflowStatus(deps.db, deps.projects, input.projectId);
  }
  await markExecutionComplete(deps.db, input.executionId);
  return persistCheckpointMessage(deps, input.projectId, input.conversationId);
}

export async function buildWorkflowContext(
  db: PrismaService,
  input: WorkflowExecutorInput,
): Promise<WorkflowContext> {
  const [conversation, resultsByStage] = await Promise.all([
    loadWorkflowConversationContext(db, input.projectId, input.conversationId),
    loadPersistedStageResults(db, input.projectId),
  ]);
  return {
    projectId: input.projectId,
    executionId: input.executionId,
    originalIdea: input.originalIdea,
    conversationHistory: conversation.history,
    clarificationRound: conversation.clarificationRound,
    resultsByStage,
  };
}

async function persistCheckpointMessage(
  deps: WorkflowExecutorDeps,
  projectId: string,
  conversationId: string,
): Promise<WorkflowStatusResponse> {
  const status = await buildWorkflowStatus(deps.db, deps.projects, projectId);
  if (!status.waiting_for) return status;
  const currentConversation =
    status.current_stage === WorkflowStage.REQUIREMENT_CLARIFICATION
      ? conversationId
      : await openCheckpointConversation(deps.db, projectId);
  if (status.waiting_for === 'reply' && status.clarification_questions?.length) {
    await appendClarificationQuestions(
      deps.db,
      currentConversation,
      status.clarification_questions,
    );
  } else {
    await appendCheckpointIntroduction(
      deps.db,
      currentConversation,
      status.current_stage as WorkflowStage,
    );
  }
  return buildWorkflowStatus(deps.db, deps.projects, projectId);
}
