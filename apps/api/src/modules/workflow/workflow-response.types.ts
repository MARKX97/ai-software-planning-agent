import type { ArtifactQualityReport, DecisionSnapshot } from '@ai-planning/shared';
import type { ModelExecutionLogResponse, WorkflowProgress } from '../usage/usage.dto.js';
import type { RegenerationImpact } from './artifact-generation/artifact-impact.js';
import type { GraphRunResponse } from './graph/graph-run.dto.js';

export interface WorkflowStatusResponse {
  project_id: string;
  conversation_id: string | null;
  status: string;
  current_stage: string;
  stage_display_name: string;
  progress: WorkflowProgress;
  waiting_for: 'reply' | 'review' | null;
  next_stage: string | null;
  clarification_questions: unknown[] | null;
  model_status: Record<string, string> | null;
  decision_snapshots: DecisionSnapshot[];
  quality_report: ArtifactQualityReport | null;
  error_message: string | null;
  started_at: string | null;
  updated_at: string;
  graph_run: GraphRunResponse | null;
  regeneration: RegenerationImpact | null;
}

export interface WorkflowStateResponse {
  id: string;
  project_id: string;
  stage: string;
  status: string;
  display_name: string;
  progress: WorkflowProgress;
  data_json: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowStateListResponse {
  items: WorkflowStateResponse[];
  total: number;
}

export interface WorkflowExecutionResponse {
  id: string;
  project_id: string;
  stage: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  retry_count: number;
  model_call_count: number | null;
  created_at: string;
}

export interface WorkflowExecutionListResponse {
  items: WorkflowExecutionResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface WorkflowExecutionDetailResponse extends WorkflowExecutionResponse {
  model_logs: ModelExecutionLogResponse[];
}
