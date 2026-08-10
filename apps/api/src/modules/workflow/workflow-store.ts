import type { WorkflowExecution } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { workflowFailureMessage } from './workflow-execution-state.js';

export { buildWorkflowStatus } from './workflow-status-store.js';
export async function createExecution(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage = WorkflowStage.REQUIREMENT_ANALYSIS,
): Promise<WorkflowExecution> {
  return db.client.workflowExecution.create({
    data: {
      project_id: projectId,
      stage,
      status: 'success',
      started_at: new Date(),
      retry_count: 0,
    },
  });
}
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

export async function markProjectStarted(db: PrismaService, projectId: string): Promise<void> {
  const now = new Date();
  await db.client.project.update({
    where: { id: projectId },
    data: {
      status: 'active',
      current_stage: WorkflowStage.REQUIREMENT_ANALYSIS,
      error_message: null,
      started_at: now,
      completed_at: null,
      updated_at: now,
    },
  });
}

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
