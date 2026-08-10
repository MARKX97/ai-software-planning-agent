import { WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { ProjectsService } from '../projects/projects.service.js';
import { loadRegenerationImpact } from './artifact-generation/artifact-impact.js';
import { artifactQualityReportFromState } from './artifact-generation/artifact-quality.js';
import { loadDecisionSnapshots } from './workflow-decisions.js';
import { buildStatusFromProject, type WorkflowStatusResponse } from './workflow-response.dto.js';

export async function buildWorkflowStatus(
  db: PrismaService,
  projects: ProjectsService,
  projectId: string,
): Promise<WorkflowStatusResponse> {
  const project = await projects.findOrFail(projectId);
  const statusData = await loadWorkflowStatusData(db, projectId, project);
  const [
    completedStages,
    activeState,
    modelStatus,
    conversation,
    decisions,
    planningState,
    graphRun,
    regeneration,
  ] = statusData;
  return buildStatusFromProject({
    project,
    completedStages,
    activeState,
    modelStatus,
    conversationId: conversation?.id ?? null,
    decisionSnapshots: decisions,
    qualityReport: artifactQualityReportFromState(planningState?.data_json),
    graphRun,
    regeneration,
  });
}

function loadWorkflowStatusData(
  db: PrismaService,
  projectId: string,
  project: Awaited<ReturnType<ProjectsService['findOrFail']>>,
) {
  return Promise.all([
    db.client.workflowState.count({ where: { project_id: projectId, status: 'completed' } }),
    db.client.workflowState.findUnique({
      where: { project_id_stage: { project_id: projectId, stage: project.current_stage } },
    }),
    buildModelStatus(db, projectId, project.current_stage),
    findWorkflowConversation(db, {
      projectId,
      stage: project.current_stage,
      projectStatus: project.status,
    }),
    loadDecisionSnapshots(db, projectId),
    db.client.workflowState.findUnique({
      where: {
        project_id_stage: { project_id: projectId, stage: WorkflowStage.PLANNING_GENERATION },
      },
      select: { data_json: true },
    }),
    db.client.graphRun.findFirst({
      where: { project_id: projectId },
      orderBy: { updated_at: 'desc' },
      include: { tool_steps: { orderBy: { created_at: 'asc' }, take: 50 } },
    }),
    loadRegenerationImpact(db, projectId),
  ]);
}

async function findWorkflowConversation(
  db: PrismaService,
  input: { projectId: string; stage: WorkflowStage; projectStatus: string },
): Promise<{ id: string } | null> {
  if (input.stage === WorkflowStage.INIT) return null;
  const status = input.projectStatus === 'active' ? 'active' : undefined;
  return db.client.conversation.findFirst({
    where: {
      project_id: input.projectId,
      ...(status ? { status } : {}),
      messages: { some: { metadata: { path: ['workflow'], equals: true } } },
    },
    orderBy: { updated_at: 'desc' },
    select: { id: true },
  });
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
