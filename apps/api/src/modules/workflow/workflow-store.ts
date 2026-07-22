import type { WorkflowExecution } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import { buildStatusFromProject, type WorkflowStatusResponse } from './workflow-response.dto.js';
import { workflowFailureMessage } from './workflow-execution-state.js';
import { loadDecisionSnapshots } from './workflow-decisions.js';
import { artifactQualityReportFromState } from './artifact-generation/artifact-quality.js';
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

export async function buildWorkflowStatus(
  db: PrismaService,
  projects: ProjectsService,
  projectId: string,
): Promise<WorkflowStatusResponse> {
  const project = await projects.findOrFail(projectId);
  const [completedStages, activeState, modelStatus, conversation, decisions, planningState] =
    await Promise.all([
      countCompletedStages(db, projectId),
      db.client.workflowState.findUnique({
        where: { project_id_stage: { project_id: projectId, stage: project.current_stage } },
      }),
      buildModelStatus(db, projectId, project.current_stage),
      findWorkflowConversation(db, projectId, project.current_stage, project.status),
      loadDecisionSnapshots(db, projectId),
      db.client.workflowState.findUnique({
        where: {
          project_id_stage: { project_id: projectId, stage: WorkflowStage.PLANNING_GENERATION },
        },
        select: { data_json: true },
      }),
    ]);
  return buildStatusFromProject({
    project,
    completedStages,
    activeState,
    modelStatus,
    conversationId: conversation?.id ?? null,
    decisionSnapshots: decisions,
    qualityReport: artifactQualityReportFromState(planningState?.data_json),
  });
}

async function findWorkflowConversation(
  db: PrismaService,
  projectId: string,
  stage: WorkflowStage,
  projectStatus: string,
): Promise<{ id: string } | null> {
  if (stage === WorkflowStage.INIT) return null;
  const status = projectStatus === 'active' ? 'active' : undefined;
  return db.client.conversation.findFirst({
    where: {
      project_id: projectId,
      ...(status ? { status } : {}),
      messages: { some: { metadata: { path: ['workflow'], equals: true } } },
    },
    orderBy: { updated_at: 'desc' },
    select: { id: true },
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
