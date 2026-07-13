/**
 * Workflow state persistence helpers.
 *
 * Source: `specs/state-machine.spec.md` §5 + §7. Keeps the pipeline runner
 * focused on orchestration while this module owns `workflow_states` upserts.
 *
 * @internal
 */
import { StageStatus, type StageResult, type WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { WorkflowStateMachine } from './state-machine/workflow-state-machine.js';
import { stageDisplayName } from './workflow-response.dto.js';
import { nextStageAfterCheckpoint, type WorkflowWait } from './workflow-checkpoints.js';

const TOTAL_STAGES = 9;

/** Mark a stage as running, creating the workflow_state row if needed. */
export async function markStageRunning(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
  stateMachine: WorkflowStateMachine,
): Promise<void> {
  await db.client.workflowState.upsert({
    where: { project_id_stage: { project_id: projectId, stage } },
    create: buildStageState(projectId, stage, StageStatus.RUNNING, stateMachine),
    update: {
      status: StageStatus.RUNNING,
      progress: buildProgress(stage, stateMachine),
      error_message: null,
      started_at: new Date(),
      updated_at: new Date(),
    },
  });
}

/** Mark a stage as completed and attach its validated output snapshot. */
export async function markStageCompleted(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
  result: StageResult,
  stateMachine: WorkflowStateMachine,
): Promise<void> {
  await db.client.workflowState.update({
    where: { project_id_stage: { project_id: projectId, stage } },
    data: {
      status: StageStatus.COMPLETED,
      progress: buildProgress(stateMachine.nextStage(stage), stateMachine),
      data_json: (result.structuredOutput ?? { content: result.content }) as never,
      completed_at: new Date(),
      updated_at: new Date(),
    },
  });
}

/** Mark clarification as running-with-data while the workflow waits for user input. */
export async function markStageWaiting(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
  result: StageResult,
  stateMachine: WorkflowStateMachine,
  waitingFor: WorkflowWait,
): Promise<void> {
  await db.client.workflowState.update({
    where: { project_id_stage: { project_id: projectId, stage } },
    data: {
      status: StageStatus.RUNNING,
      progress: buildProgress(stage, stateMachine),
      data_json: waitingData(result, waitingFor) as never,
      updated_at: new Date(),
    },
  });
}

export async function markCheckpointConfirmed(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
): Promise<void> {
  const state = await db.client.workflowState.findUnique({
    where: { project_id_stage: { project_id: projectId, stage } },
  });
  const data = state?.data_json;
  const nextData = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : data;
  if (nextData && typeof nextData === 'object' && !Array.isArray(nextData)) {
    delete (nextData as Record<string, unknown>)['_workflow'];
  }
  await db.client.workflowState.update({
    where: { project_id_stage: { project_id: projectId, stage } },
    data: { status: StageStatus.COMPLETED, data_json: nextData as never, updated_at: new Date() },
  });
}

function waitingData(result: StageResult, waitingFor: WorkflowWait): Record<string, unknown> {
  const output = result.structuredOutput;
  const data = output && typeof output === 'object' && !Array.isArray(output) ? output : {};
  return {
    ...data,
    _workflow: { waiting_for: waitingFor, next_stage: nextStageAfterCheckpoint(result.stage) },
    ...(Object.keys(data).length === 0 ? { content: result.content } : {}),
  };
}

function buildStageState(
  projectId: string,
  stage: WorkflowStage,
  status: StageStatus,
  stateMachine: WorkflowStateMachine,
): {
  project_id: string;
  stage: WorkflowStage;
  status: StageStatus;
  display_name: string;
  progress: never;
  updated_at: Date;
  started_at: Date | null;
} {
  return {
    project_id: projectId,
    stage,
    status,
    display_name: stageDisplayName(stage),
    progress: buildProgress(stage, stateMachine),
    updated_at: new Date(),
    started_at: status === StageStatus.RUNNING ? new Date() : null,
  };
}

function buildProgress(stage: WorkflowStage, stateMachine: WorkflowStateMachine): never {
  const percentage = stateMachine.progressPercent(stage);
  return {
    completed_stages: Math.round((percentage / 100) * TOTAL_STAGES),
    total_stages: TOTAL_STAGES,
    percentage,
  } as never;
}
