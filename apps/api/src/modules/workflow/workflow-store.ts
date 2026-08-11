import type { Prisma, Project, WorkflowExecution } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { workflowFailureMessage } from './workflow-execution-state.js';
import type { GraphResumeInput } from './graph/agent-graph.service.js';
import { graphLeaseDeadline } from './graph/graph-run-lease.js';

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

interface ClaimWorkflowExecutionInput {
  readonly project: Project;
  readonly stage: WorkflowStage;
  readonly resume?: GraphResumeInput;
  readonly restartProject?: boolean;
}

export async function claimWorkflowExecution(
  db: PrismaService,
  input: ClaimWorkflowExecutionInput,
): Promise<WorkflowExecution> {
  return db.client.$transaction((tx) => claimWorkflowExecutionInTransaction(tx, input));
}

export async function claimWorkflowExecutionInTransaction(
  tx: Prisma.TransactionClient,
  input: ClaimWorkflowExecutionInput,
): Promise<WorkflowExecution> {
  const now = new Date();
  await claimGraphRun(tx, input, now);
  const claimed = await tx.project.updateMany({
    where: {
      id: input.project.id,
      status: input.project.status,
      current_stage: input.project.current_stage,
      deleted_at: null,
    },
    data: {
      current_stage: input.stage,
      updated_at: now,
      ...(input.restartProject
        ? {
            status: 'active' as const,
            error_message: null,
            started_at: now,
            completed_at: null,
          }
        : {}),
    },
  });
  if (claimed.count !== 1) {
    throw AppException.conflict(
      ErrorCode.WORKFLOW_ALREADY_RUNNING,
      'Workflow is already running for this project',
    );
  }
  return tx.workflowExecution.create({
    data: {
      project_id: input.project.id,
      stage: input.stage,
      status: 'success',
      started_at: now,
      retry_count: 0,
    },
  });
}

async function claimGraphRun(
  tx: Prisma.TransactionClient,
  input: ClaimWorkflowExecutionInput,
  now: Date,
): Promise<void> {
  if (!input.resume) return;
  const statusFilter =
    input.resume.claimStatus === 'expired'
      ? { status: 'running', lease_expires_at: { lte: now } }
      : { status: input.resume.claimStatus };
  const claimed = await tx.graphRun.updateMany({
    where: {
      id: input.resume.graphRunId,
      project_id: input.project.id,
      checkpoint_version: input.resume.checkpointVersion,
      ...statusFilter,
    },
    data: { status: 'running', lease_expires_at: graphLeaseDeadline(now), updated_at: now },
  });
  if (claimed.count !== 1) {
    throw AppException.conflict(ErrorCode.INVALID_STAGE_TRANSITION, 'Graph checkpoint is stale');
  }
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

interface MarkFailedInput {
  readonly db: PrismaService;
  readonly projectId: string;
  readonly executionId: string;
  readonly error: unknown;
}

export async function markFailed(input: MarkFailedInput): Promise<void> {
  const { db, projectId, executionId, error } = input;
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
