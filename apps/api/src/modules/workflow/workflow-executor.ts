import { LLMCancelledError, type LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { WorkflowStage, type LLMStreamOptions, type WorkflowContext } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import type { KnowledgeRetrievalService } from '../knowledge/knowledge-retrieval.service.js';
import {
  closeWorkflowConversation,
  loadWorkflowConversationContext,
} from './workflow-conversation.js';
import { toMessageResponse, type MessageResponse } from '../conversations/conversations.dto.js';
import { loadPersistedStageResults } from './workflow-results.js';
import { runPipeline, type PipelineRunDeps } from './workflow-pipeline-runner.js';
import type { AgentGraphService, GraphResumeInput } from './graph/agent-graph.service.js';
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
import {
  loadWorkflowCheckpointMessage,
  persistWorkflowCheckpoint,
} from './workflow-checkpoint-persistence.js';

export interface WorkflowExecutorDeps {
  readonly db: PrismaService;
  readonly projects: ProjectsService;
  readonly orchestrator: LlmOrchestratorService;
  readonly knowledge?: KnowledgeRetrievalService;
  readonly graph?: AgentGraphService;
}

export interface WorkflowExecutorInput {
  readonly projectId: string;
  readonly executionId: string;
  readonly originalIdea: string;
  readonly conversationId: string;
  readonly startStage?: WorkflowStage;
  readonly userMessage?: string;
  readonly stream?: Pick<LLMStreamOptions, 'onDelta' | 'signal'>;
  readonly graphResume?: GraphResumeInput;
  readonly regenerationTargets?: readonly string[];
  readonly restoreStageOnFailure?: WorkflowStage;
}

export interface WorkflowExecutionResult {
  readonly status: WorkflowStatusResponse;
  readonly assistantMessage: MessageResponse | null;
}

interface CheckpointCapture {
  message: Awaited<ReturnType<typeof persistWorkflowCheckpoint>> | null;
}

export async function executeWorkflowPipeline(
  deps: WorkflowExecutorDeps,
  input: WorkflowExecutorInput,
): Promise<WorkflowExecutionResult> {
  const ctx = await buildWorkflowContext(deps.db, input);
  const checkpoint: CheckpointCapture = { message: null };
  try {
    const pipelineDeps = createPipelineDeps(deps, input, checkpoint);
    const finalStage = deps.graph?.enabled
      ? await deps.graph.execute({
          context: ctx,
          deps: pipelineDeps,
          startStage: input.startStage ?? WorkflowStage.REQUIREMENT_ANALYSIS,
          resume: input.graphResume,
        })
      : await runPipeline(ctx, pipelineDeps, { startStage: input.startStage });
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
    await markFailed({
      db: deps.db,
      projectId: input.projectId,
      executionId: input.executionId,
      error,
    });
    return {
      status: await buildWorkflowStatus(deps.db, deps.projects, input.projectId),
      assistantMessage: null,
    };
  }
  await markExecutionComplete(deps.db, input.executionId);
  return completedExecutionResult(deps, input, checkpoint);
}

async function completedExecutionResult(
  deps: WorkflowExecutorDeps,
  input: WorkflowExecutorInput,
  checkpoint: CheckpointCapture,
): Promise<WorkflowExecutionResult> {
  const status = await buildWorkflowStatus(deps.db, deps.projects, input.projectId);
  const message =
    checkpoint.message ??
    (status.waiting_for && status.conversation_id
      ? await loadWorkflowCheckpointMessage(deps.db, status.conversation_id)
      : null);
  return {
    status,
    assistantMessage: message ? toMessageResponse(message) : null,
  };
}

function createPipelineDeps(
  deps: WorkflowExecutorDeps,
  input: WorkflowExecutorInput,
  checkpoint: CheckpointCapture,
): PipelineRunDeps {
  return {
    db: deps.db,
    orchestrator: deps.orchestrator,
    dataDir: deps.projects.dataDir(),
    knowledge: deps.knowledge,
    stream: input.stream,
    onCheckpoint: async (pending) => {
      checkpoint.message = await persistWorkflowCheckpoint({
        db: deps.db,
        workflowConversationId: input.conversationId,
        userMessage: input.userMessage,
        ...pending,
      });
    },
  };
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
    conversationHistory: buildControlledHistory(
      conversation.confirmedDecisions,
      appendCurrentMessage(conversation.history, input.userMessage),
    ),
    confirmedDecisions: conversation.confirmedDecisions,
    regenerationTargets: input.regenerationTargets,
    clarificationRound: conversation.clarificationRound + (input.userMessage ? 1 : 0),
    resultsByStage,
  };
}

const MAX_CONTEXT_CHARACTERS = 24_000;

function buildControlledHistory(
  decisions: WorkflowContext['confirmedDecisions'],
  currentConversation: string,
): string {
  const confirmed = decisions
    .map((item) =>
      [
        `[confirmed:${item.stage}] ${item.summary}`,
        ...item.decisions.map((decision) => `- ${decision}`),
        ...item.user_feedback.map((feedback) => `- 用户补充：${feedback}`),
      ].join('\n'),
    )
    .join('\n');
  const prefix = confirmed ? `${confirmed}\n\n[current_conversation]\n` : '';
  const remaining = Math.max(0, MAX_CONTEXT_CHARACTERS - prefix.length);
  return `${prefix.slice(0, MAX_CONTEXT_CHARACTERS)}${currentConversation.slice(-remaining)}`;
}

function appendCurrentMessage(history: string, message?: string): string {
  return [history, message ? `user: ${message}` : ''].filter(Boolean).join('\n');
}

export async function recoverStreamFailure(
  db: PrismaService,
  input: WorkflowExecutorInput,
  error: unknown,
): Promise<void> {
  if (input.restoreStageOnFailure) {
    if (error instanceof LLMCancelledError) {
      await markExecutionCancelled(db, input.executionId);
    } else {
      await markExecutionFailed(db, input.executionId, error);
    }
    await updateProjectStage(db, input.projectId, input.restoreStageOnFailure);
    return;
  }
  if (error instanceof LLMCancelledError) {
    await Promise.all([
      markExecutionCancelled(db, input.executionId),
      markProjectCancelled(db, input.projectId),
    ]);
    return;
  }
  await markFailed({ db, projectId: input.projectId, executionId: input.executionId, error });
}
