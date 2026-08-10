import type {
  ModelExecutionLog,
  Project,
  WorkflowExecution,
  WorkflowState,
} from '@ai-planning/database';
import { toModelExecutionLogResponse, type WorkflowProgress } from '../usage/usage.dto.js';
import { WorkflowStage } from '@ai-planning/shared';
import type { ArtifactQualityReport, DecisionSnapshot } from '@ai-planning/shared';
import { workflowInteraction } from './workflow-checkpoints.js';
import { toGraphRunResponse } from './graph/graph-run.dto.js';
import type { RegenerationImpact } from './artifact-generation/artifact-impact.js';
import type {
  WorkflowExecutionDetailResponse,
  WorkflowExecutionResponse,
  WorkflowStateResponse,
  WorkflowStatusResponse,
} from './workflow-response.types.js';

export type {
  WorkflowExecutionDetailResponse,
  WorkflowExecutionListResponse,
  WorkflowExecutionResponse,
  WorkflowStateListResponse,
  WorkflowStateResponse,
  WorkflowStatusResponse,
} from './workflow-response.types.js';
export type { GraphRunResponse } from './graph/graph-run.dto.js';

const STAGE_DISPLAY_NAMES: Record<string, string> = {
  init: '初始化',
  requirement_analysis: '需求分析',
  requirement_clarification: '需求澄清',
  multi_model_analysis: '多模型分析',
  requirement_synthesis: '需求综合',
  feasibility_analysis: '可行性分析',
  risk_analysis: '风险分析',
  mvp_compression: 'MVP压缩',
  platform_recommendation: '平台推荐',
  planning_generation: '规划生成',
  completed: '已完成',
  failed: '失败',
};

const TOTAL_STAGES = 9;

export function stageDisplayName(stage: string): string {
  return STAGE_DISPLAY_NAMES[stage] ?? stage;
}

export function buildProgress(completedStages: number): WorkflowProgress {
  const safe = Math.max(0, Math.min(completedStages, TOTAL_STAGES));
  const percentage = Math.round((safe / TOTAL_STAGES) * 100);
  return { completed_stages: safe, total_stages: TOTAL_STAGES, percentage };
}

function parseProgress(raw: unknown): WorkflowProgress {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const completed = typeof r['completed_stages'] === 'number' ? r['completed_stages'] : 0;
    const total = typeof r['total_stages'] === 'number' ? r['total_stages'] : TOTAL_STAGES;
    const pct =
      typeof r['percentage'] === 'number' ? r['percentage'] : Math.round((completed / total) * 100);
    return { completed_stages: completed, total_stages: total, percentage: pct };
  }
  return buildProgress(0);
}

export function toWorkflowStateResponse(s: WorkflowState): WorkflowStateResponse {
  return {
    id: s.id,
    project_id: s.project_id,
    stage: s.stage,
    status: s.status,
    display_name: s.display_name,
    progress: parseProgress(s.progress),
    data_json: (s.data_json as Record<string, unknown> | null) ?? null,
    error_message: s.error_message,
    started_at: s.started_at?.toISOString() ?? null,
    completed_at: s.completed_at?.toISOString() ?? null,
    created_at: s.created_at.toISOString(),
  };
}

export function toWorkflowExecutionResponse(
  e: WorkflowExecution,
  modelCallCount: number | null,
): WorkflowExecutionResponse {
  return {
    id: e.id,
    project_id: e.project_id,
    stage: e.stage,
    status: e.status,
    started_at: e.started_at.toISOString(),
    completed_at: e.completed_at?.toISOString() ?? null,
    duration_ms: e.duration_ms,
    error_message: e.error_message,
    retry_count: e.retry_count,
    model_call_count: modelCallCount,
    created_at: e.created_at.toISOString(),
  };
}

export function toWorkflowExecutionDetailResponse(
  e: WorkflowExecution,
  modelCallCount: number | null,
  logs: ModelExecutionLog[],
): WorkflowExecutionDetailResponse {
  return {
    ...toWorkflowExecutionResponse(e, modelCallCount),
    model_logs: logs.map(toModelExecutionLogResponse),
  };
}

export function buildStatusFromProject(input: {
  readonly project: Project;
  readonly completedStages: number;
  readonly activeState?: WorkflowState | null;
  readonly modelStatus?: Record<string, string> | null;
  readonly conversationId?: string | null;
  readonly decisionSnapshots?: DecisionSnapshot[];
  readonly qualityReport?: ArtifactQualityReport | null;
  readonly graphRun?: Parameters<typeof toGraphRunResponse>[0];
  readonly regeneration?: RegenerationImpact | null;
}): WorkflowStatusResponse {
  const interaction = workflowInteraction(input.activeState?.data_json);
  return {
    project_id: input.project.id,
    conversation_id: input.conversationId ?? null,
    status: input.project.status,
    current_stage: input.project.current_stage,
    stage_display_name: stageDisplayName(input.project.current_stage),
    progress: buildProgress(input.completedStages),
    waiting_for: interaction.waitingFor,
    next_stage: interaction.nextStage,
    clarification_questions: extractClarificationQuestions(
      input.project,
      input.activeState ?? null,
    ),
    model_status: input.modelStatus ?? null,
    decision_snapshots: input.decisionSnapshots ?? [],
    quality_report: input.qualityReport ?? null,
    error_message: input.project.error_message,
    started_at: input.project.started_at?.toISOString() ?? null,
    updated_at: input.project.updated_at.toISOString(),
    graph_run: toGraphRunResponse(input.graphRun),
    regeneration: input.regeneration ?? null,
  };
}

function extractClarificationQuestions(
  project: Project,
  activeState: WorkflowState | null,
): unknown[] | null {
  if (
    project.current_stage !== WorkflowStage.REQUIREMENT_CLARIFICATION ||
    !activeState?.data_json
  ) {
    return null;
  }
  const data = activeState.data_json as Record<string, unknown>;
  const questions = data['clarification_questions'];
  return Array.isArray(questions) ? questions : null;
}
