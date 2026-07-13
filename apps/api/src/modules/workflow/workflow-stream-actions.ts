import { LLMCancelledError, type LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { WorkflowStage, type LLMStreamOptions } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import type { ProjectsService } from '../projects/projects.service.js';
import { toMessageResponse } from '../conversations/conversations.dto.js';
import type {
  ContinueWorkflowRequest,
  DiscussWorkflowRequest,
  RunWorkflowRequest,
} from './workflow.dto.js';
import { assertCanContinueWorkflow, assertWorkflowNotRunning } from './workflow-guards.js';
import { assertWorkflowInteraction } from './workflow-interaction-guard.js';
import { appendWorkflowInteraction, resolveWorkflowConversation } from './workflow-conversation.js';
import { buildWorkflowContext, executeWorkflowPipeline } from './workflow-executor.js';
import { CheckpointDiscussionStage } from './stages/checkpoint-discussion.stage.js';
import {
  buildWorkflowStatus,
  createExecution,
  markProjectStarted,
  updateProjectStage,
} from './workflow-store.js';
import {
  markExecutionCancelled,
  markExecutionComplete,
  markExecutionFailed,
} from './workflow-execution-state.js';
import { WorkflowSse } from './workflow-sse.js';

export interface WorkflowStreamDeps {
  readonly db: PrismaService;
  readonly projects: ProjectsService;
  readonly orchestrator: LlmOrchestratorService;
}

interface StreamInput<T> {
  readonly projectId: string;
  readonly body: T;
  readonly stream: WorkflowSse;
}

export async function streamRun(
  deps: WorkflowStreamDeps,
  input: StreamInput<RunWorkflowRequest>,
): Promise<void> {
  const project = await deps.projects.findOrFail(input.projectId);
  assertWorkflowNotRunning(project);
  const conversationId = await resolveWorkflowConversation(
    deps.db,
    input.projectId,
    input.body.conversation_id,
  );
  const execution = await createExecution(deps.db, input.projectId);
  await markProjectStarted(deps.db, input.projectId);
  input.stream.open();
  await finishStream(input.stream, async () =>
    executeWorkflowPipeline(deps, {
      projectId: input.projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId,
      stream: streamOptions(input.stream),
    }),
  );
}

export async function streamContinue(
  deps: WorkflowStreamDeps,
  input: StreamInput<ContinueWorkflowRequest>,
): Promise<void> {
  const project = await deps.projects.findOrFail(input.projectId);
  const status = await buildWorkflowStatus(deps.db, deps.projects, input.projectId);
  await resolveWorkflowConversation(deps.db, input.projectId, input.body.conversation_id);
  assertCanContinueWorkflow(project);
  assertWorkflowInteraction(status, input.body.conversation_id, 'reply');
  const execution = await createExecution(deps.db, input.projectId);
  await updateProjectStage(deps.db, input.projectId, WorkflowStage.REQUIREMENT_ANALYSIS);
  input.stream.open();
  await finishStream(input.stream, async () =>
    executeWorkflowPipeline(deps, {
      projectId: input.projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId: input.body.conversation_id,
      startStage: WorkflowStage.REQUIREMENT_ANALYSIS,
      userMessage: input.body.message,
      stream: streamOptions(input.stream),
    }),
  );
}

export async function streamDiscuss(
  deps: WorkflowStreamDeps,
  input: StreamInput<DiscussWorkflowRequest>,
): Promise<void> {
  const project = await deps.projects.findOrFail(input.projectId);
  const status = await buildWorkflowStatus(deps.db, deps.projects, input.projectId);
  await resolveWorkflowConversation(deps.db, input.projectId, input.body.conversation_id);
  assertWorkflowInteraction(status, input.body.conversation_id);
  const stage = project.current_stage as WorkflowStage;
  const execution = await createExecution(deps.db, input.projectId, stage);
  input.stream.open();
  try {
    const ctx = await buildWorkflowContext(deps.db, {
      projectId: input.projectId,
      executionId: execution.id,
      originalIdea: project.original_idea,
      conversationId: input.body.conversation_id,
      userMessage: input.body.message,
    });
    const reply = await new CheckpointDiscussionStage({
      db: deps.db,
      orchestrator: deps.orchestrator,
      dataDir: deps.projects.dataDir(),
      stream: streamOptions(input.stream),
    }).execute(ctx, stage);
    const message = await appendWorkflowInteraction(deps.db, {
      conversationId: input.body.conversation_id,
      userContent: input.body.message,
      assistantContent: reply,
      stage,
    });
    await markExecutionComplete(deps.db, execution.id);
    const nextStatus = await buildWorkflowStatus(deps.db, deps.projects, input.projectId);
    input.stream.done(toMessageResponse(message), nextStatus);
  } catch (error) {
    await markStreamExecutionError(deps.db, execution.id, error);
    input.stream.fail(error);
  }
}

function streamOptions(stream: WorkflowSse): Pick<LLMStreamOptions, 'onDelta' | 'signal'> {
  return { onDelta: (content: string) => stream.delta(content), signal: stream.signal };
}

async function finishStream(
  stream: WorkflowSse,
  execute: () => ReturnType<typeof executeWorkflowPipeline>,
): Promise<void> {
  try {
    const result = await execute();
    if (!result.assistantMessage) throw new Error('Workflow stream completed without a reply');
    stream.done(result.assistantMessage, result.status);
  } catch (error) {
    stream.fail(error);
  }
}

async function markStreamExecutionError(
  db: PrismaService,
  executionId: string,
  error: unknown,
): Promise<void> {
  if (error instanceof LLMCancelledError) {
    await markExecutionCancelled(db, executionId);
  } else {
    await markExecutionFailed(db, executionId, error);
  }
}
