import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { AppException } from '../../../common/exception/app-exception.js';
import { ErrorCode } from '../../../common/exception/error-code.js';
import { graphLeaseDeadline, type GraphClaimStatus } from './graph-run-lease.js';
import type { PlanningGraphState } from './planning-graph.js';

export function createGraphRun(
  db: PrismaService,
  input: { projectId: string; executionId: string; stage: WorkflowStage },
) {
  return db.client.graphRun.create({
    data: {
      project_id: input.projectId,
      execution_id: input.executionId,
      status: 'running',
      current_node: 'start',
      current_stage: input.stage,
      lease_expires_at: graphLeaseDeadline(),
      updated_at: new Date(),
    },
  });
}

export function findRetryGraphRun(
  db: PrismaService,
  input: { projectId: string; claimStatus: GraphClaimStatus; now: Date },
) {
  return db.client.graphRun.findFirst({
    where: {
      project_id: input.projectId,
      ...(input.claimStatus === 'expired'
        ? { status: 'running', lease_expires_at: { lte: input.now } }
        : { status: 'failed' }),
    },
    orderBy: { updated_at: 'desc' },
  });
}

export async function attachGraphRun(
  db: PrismaService,
  input: { runId: string; projectId: string; executionId: string; checkpointVersion: number },
) {
  const attached = await db.client.graphRun.updateMany({
    where: {
      id: input.runId,
      project_id: input.projectId,
      status: 'running',
      checkpoint_version: input.checkpointVersion,
    },
    data: { execution_id: input.executionId, updated_at: new Date() },
  });
  if (attached.count !== 1) {
    throw AppException.conflict(ErrorCode.INVALID_STAGE_TRANSITION, 'Graph checkpoint is stale');
  }
  return { id: input.runId };
}

export async function completeGraphRun(
  db: PrismaService,
  input: { runId: string; state: PlanningGraphState; interrupted: boolean },
): Promise<WorkflowStage> {
  const { runId, state, interrupted } = input;
  await db.client.graphRun.update({
    where: { id: runId },
    data: {
      status: interrupted ? 'interrupted' : 'completed',
      current_node: interrupted ? state.currentNode : 'end',
      current_stage: interrupted ? (state.currentNode as WorkflowStage) : WorkflowStage.COMPLETED,
      waiting_for: interrupted ? state.waitingFor : null,
      checkpoint_version: { increment: 1 },
      lease_expires_at: null,
      completed_at: interrupted ? null : new Date(),
      updated_at: new Date(),
    },
  });
  return interrupted ? (state.currentNode as WorkflowStage) : WorkflowStage.COMPLETED;
}

export async function failGraphRun(
  db: PrismaService,
  input: {
    runId: string;
    cancelled: boolean;
    state?: PlanningGraphState;
    nextNode?: string;
    startStage: WorkflowStage;
  },
): Promise<void> {
  await db.client.graphRun.update({
    where: { id: input.runId },
    data: {
      status: input.cancelled ? 'cancelled' : 'failed',
      current_node: input.cancelled ? 'cancelled' : (input.nextNode ?? 'failed'),
      current_stage: input.state?.stage ?? input.startStage,
      lease_expires_at: null,
      updated_at: new Date(),
    },
  });
}
