import { LLMCancelledError, type LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { WorkflowStage, type LLMStreamOptions, type WorkflowContext } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  appendCheckpointIntroduction,
  appendWorkflowInteraction,
  closeWorkflowConversation,
  loadWorkflowConversationContext,
  openCheckpointConversation,
} from './workflow-conversation.js';
import { toMessageResponse, type MessageResponse } from '../conversations/conversations.dto.js';
import { loadPersistedStageResults } from './workflow-results.js';
import { runPipeline } from './workflow-pipeline-runner.js';
import type { WorkflowStatusResponse } from './workflow-response.dto.js';
import {
  buildWorkflowStatus,
  markFailed,
  markProjectComplete,
  updateProjectStage,
} from './workflow-store.js';
import {
  markExecutionCancelled,
  markExecutionComplete,
  markExecutionFailed,
  markProjectCancelled,
} from './workflow-execution-state.js';

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
  readonly userMessage?: string;
  readonly stream?: Pick<LLMStreamOptions, 'onDelta' | 'signal'>;
}

export interface WorkflowExecutionResult {
  readonly status: WorkflowStatusResponse;
  readonly assistantMessage: MessageResponse | null;
}

export async function executeWorkflowPipeline(
  deps: WorkflowExecutorDeps,
  input: WorkflowExecutorInput,
): Promise<WorkflowExecutionResult> {
  const ctx = await buildWorkflowContext(deps.db, input);
  try {
    const finalStage = await runPipeline(
      ctx,
      {
        db: deps.db,
        orchestrator: deps.orchestrator,
        dataDir: deps.projects.dataDir(),
        stream: input.stream,
      },
      { startStage: input.startStage },
    );
    if (finalStage === WorkflowStage.COMPLETED) {
      await Promise.all([
        markProjectComplete(deps.db, input.projectId),
        closeWorkflowConversation(deps.db, input.conversationId),
      ]);
    }
  } catch (error) {
    if (input.stream) {
      await recoverStreamFailure(deps.db, input, error);
      throw error;
    }
    await markFailed(deps.db, input.projectId, input.executionId, error);
    return {
      status: await buildWorkflowStatus(deps.db, deps.projects, input.projectId),
      assistantMessage: null,
    };
  }
  await markExecutionComplete(deps.db, input.executionId);
  return persistCheckpointMessage(deps, input, ctx);
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
    conversationHistory: appendCurrentMessage(conversation.history, input.userMessage),
    clarificationRound: conversation.clarificationRound + (input.userMessage ? 1 : 0),
    resultsByStage,
  };
}

async function persistCheckpointMessage(
  deps: WorkflowExecutorDeps,
  input: WorkflowExecutorInput,
  ctx: WorkflowContext,
): Promise<WorkflowExecutionResult> {
  const status = await buildWorkflowStatus(deps.db, deps.projects, input.projectId);
  if (!status.waiting_for) return { status, assistantMessage: null };
  const currentConversation =
    status.current_stage === WorkflowStage.REQUIREMENT_CLARIFICATION
      ? input.conversationId
      : await openCheckpointConversation(deps.db, input.projectId);
  const reply = ctx.resultsByStage[WorkflowStage.REQUIREMENT_CLARIFICATION]?.content;
  const message =
    status.current_stage === WorkflowStage.REQUIREMENT_CLARIFICATION
      ? await appendWorkflowInteraction(deps.db, {
          conversationId: currentConversation,
          userContent: input.userMessage,
          assistantContent: reply ?? '需求信息已经更新。',
          stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
          kind: 'clarification_reply',
          questions: status.clarification_questions,
        })
      : await appendCheckpointIntroduction(
          deps.db,
          currentConversation,
          status.current_stage as WorkflowStage,
        );
  return {
    status: await buildWorkflowStatus(deps.db, deps.projects, input.projectId),
    assistantMessage: toMessageResponse(message),
  };
}

function appendCurrentMessage(history: string, message?: string): string {
  return [history, message ? `user: ${message}` : ''].filter(Boolean).join('\n');
}

async function recoverStreamFailure(
  db: PrismaService,
  input: WorkflowExecutorInput,
  error: unknown,
): Promise<void> {
  if (input.startStage === WorkflowStage.REQUIREMENT_ANALYSIS) {
    if (error instanceof LLMCancelledError) {
      await markExecutionCancelled(db, input.executionId);
    } else {
      await markExecutionFailed(db, input.executionId, error);
    }
    await updateProjectStage(db, input.projectId, WorkflowStage.REQUIREMENT_CLARIFICATION);
    return;
  }
  if (error instanceof LLMCancelledError) {
    await Promise.all([
      markExecutionCancelled(db, input.executionId),
      markProjectCancelled(db, input.projectId),
    ]);
    return;
  }
  await markFailed(db, input.projectId, input.executionId, error);
}
