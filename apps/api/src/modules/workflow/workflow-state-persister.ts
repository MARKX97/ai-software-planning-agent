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

interface StageStateInput {
  readonly db: PrismaService;
  readonly projectId: string;
  readonly stage: WorkflowStage;
  readonly stateMachine: WorkflowStateMachine;
}

interface StageResultStateInput extends StageStateInput {
  readonly result: StageResult;
}

interface WaitingStageStateInput extends StageResultStateInput {
  readonly waitingFor: WorkflowWait;
}

/** Mark a stage as running, creating the workflow_state row if needed. */
export async function markStageRunning(input: StageStateInput): Promise<void> {
  const { db, projectId, stage, stateMachine } = input;
  await db.client.workflowState.upsert({
    where: { project_id_stage: { project_id: projectId, stage } },
    create: buildStageState({ projectId, stage, status: StageStatus.RUNNING, stateMachine }),
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
export async function markStageCompleted(input: StageResultStateInput): Promise<void> {
  const { db, projectId, stage, result, stateMachine } = input;
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
export async function markStageWaiting(input: WaitingStageStateInput): Promise<void> {
  const { db, projectId, stage, result, stateMachine, waitingFor } = input;
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

export function confirmedStateData(data: unknown): unknown {
  const nextData = data && typeof data === 'object' && !Array.isArray(data) ? { ...data } : data;
  if (nextData && typeof nextData === 'object' && !Array.isArray(nextData)) {
    delete (nextData as Record<string, unknown>)['_workflow'];
  }
  return nextData;
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

interface BuildStageStateInput {
  readonly projectId: string;
  readonly stage: WorkflowStage;
  readonly status: StageStatus;
  readonly stateMachine: WorkflowStateMachine;
}

function buildStageState(input: BuildStageStateInput): {
  project_id: string;
  stage: WorkflowStage;
  status: StageStatus;
  display_name: string;
  progress: never;
  updated_at: Date;
  started_at: Date | null;
} {
  const { projectId, stage, status, stateMachine } = input;
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
