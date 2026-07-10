import type { WorkflowExecution } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { buildStatusFromProject, type WorkflowStatusResponse } from './workflow-response.dto.js';

/** Persistence helpers for workflow service orchestration. */
export async function createExecution(
  db: PrismaService,
  projectId: string,
): Promise<WorkflowExecution> {
  return db.client.workflowExecution.create({
    data: {
      project_id: projectId,
      stage: WorkflowStage.REQUIREMENT_ANALYSIS,
      status: 'success',
      started_at: new Date(),
      retry_count: 0,
    },
  });
}

/** Load all project conversation messages as a model-friendly transcript. */
export async function loadConversationHistory(
  db: PrismaService,
  projectId: string,
): Promise<string> {
  const conversations = await db.client.conversation.findMany({
    where: { project_id: projectId },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  return conversations
    .flatMap((c) => c.messages)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}

/** Update the project's current workflow stage. */
export async function updateProjectStage(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
): Promise<void> {
  await db.client.project.update({
    where: { id: projectId },
    data: { current_stage: stage, updated_at: new Date() },
  });
}

/** Mark an execution as successful. */
export async function markExecutionComplete(db: PrismaService, executionId: string): Promise<void> {
  await db.client.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'success', completed_at: new Date() },
  });
}

/** Mark the project as fully completed. */
export async function markProjectComplete(db: PrismaService, projectId: string): Promise<void> {
  await db.client.project.update({
    where: { id: projectId },
    data: {
      status: 'completed',
      current_stage: WorkflowStage.COMPLETED,
      completed_at: new Date(),
      updated_at: new Date(),
    },
  });
}

/** Mark the execution and project as failed with a user-visible error message. */
export async function markFailed(
  db: PrismaService,
  projectId: string,
  executionId: string,
  error: unknown,
): Promise<void> {
  const message = workflowFailureMessage(error);
  await db.client.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'failed', error_message: message, completed_at: new Date() },
  });
  await db.client.project.update({
    where: { id: projectId },
    data: {
      current_stage: WorkflowStage.FAILED,
      status: 'failed',
      error_message: message,
      updated_at: new Date(),
    },
  });
}

function workflowFailureMessage(error: unknown): string {
  if (error instanceof AppException) {
    const response = error.getResponse();
    if (typeof response === 'object' && response) {
      const message = (response as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
  }
  return '工作流执行失败，请稍后重试。';
}

/** Build current workflow status including clarification/model details when present. */
export async function buildWorkflowStatus(
  db: PrismaService,
  projects: ProjectsService,
  projectId: string,
): Promise<WorkflowStatusResponse> {
  const project = await projects.findOrFail(projectId);
  const [completedStages, activeState, modelStatus] = await Promise.all([
    countCompletedStages(db, projectId),
    db.client.workflowState.findUnique({
      where: { project_id_stage: { project_id: projectId, stage: project.current_stage } },
    }),
    buildModelStatus(db, projectId, project.current_stage),
  ]);
  return buildStatusFromProject(project, completedStages, activeState, modelStatus);
}

/** Find an execution belonging to the project or throw the contract error. */
export async function findExecutionOrFail(
  db: PrismaService,
  projectId: string,
  executionId: string,
): Promise<WorkflowExecution> {
  const execution = await db.client.workflowExecution.findUnique({ where: { id: executionId } });
  if (!execution || execution.project_id !== projectId) {
    throw AppException.notFound(
      ErrorCode.EXECUTION_NOT_FOUND,
      `Execution '${executionId}' not found`,
    );
  }
  return execution;
}

/** Assert a conversation belongs to the project. */
export async function findConversationOrFail(
  db: PrismaService,
  projectId: string,
  conversationId: string,
): Promise<void> {
  const conversation = await db.client.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.project_id !== projectId) {
    throw AppException.notFound(
      ErrorCode.CONVERSATION_NOT_FOUND,
      `Conversation '${conversationId}' not found in project '${projectId}'`,
    );
  }
}

/** Count model call logs for a page of execution rows. */
export async function countModelLogs(
  db: PrismaService,
  rows: WorkflowExecution[],
): Promise<number[]> {
  if (rows.length === 0) return [];
  const grouped = await db.client.modelExecutionLog.groupBy({
    by: ['execution_id'],
    where: { execution_id: { in: rows.map((r) => r.id) } },
    _count: { _all: true },
  });
  const map = new Map<string, number>();
  for (const g of grouped) {
    if (g.execution_id !== null) map.set(g.execution_id, g._count._all);
  }
  return rows.map((r) => map.get(r.id) ?? 0);
}

async function countCompletedStages(db: PrismaService, projectId: string): Promise<number> {
  return db.client.workflowState.count({ where: { project_id: projectId, status: 'completed' } });
}

async function buildModelStatus(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
): Promise<Record<string, string> | null> {
  if (stage !== WorkflowStage.MULTI_MODEL_ANALYSIS) return null;
  const logs = await db.client.modelExecutionLog.findMany({
    where: { project_id: projectId, stage },
    orderBy: { created_at: 'desc' },
    take: 3,
  });
  const status: Record<string, string> = {
    deepseek: 'pending',
    glm: 'pending',
    minimax: 'pending',
  };
  for (const log of logs) {
    status[log.provider_name] = log.status === 'success' ? 'completed' : 'failed';
  }
  return status;
}
