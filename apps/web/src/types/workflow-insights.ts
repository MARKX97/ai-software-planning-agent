export interface WorkflowProgress {
  completed_stages: number;
  total_stages: number;
  percentage: number;
}

export interface DecisionSnapshot {
  stage: string;
  summary: string;
  decisions: string[];
  user_feedback: string[];
  confirmed_at: string;
}

export interface ArtifactQualityCheck {
  id: string;
  label: string;
  status: 'passed' | 'warning';
  affected_artifacts: string[];
  message: string;
}

export interface ArtifactQualityReport {
  status: 'passed' | 'warning';
  expected_artifacts: 11;
  generated_artifacts: number;
  checks: ArtifactQualityCheck[];
  revised_artifacts: string[];
}

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
  graph_run: {
    id: string;
    status: string;
    current_node: string;
    current_stage: string;
    checkpoint_version: number;
    waiting_for: 'reply' | 'review' | null;
    recovery_available: boolean;
    tool_call_count: number;
    retrieval_summary: string | null;
    interrupt_reason: 'reply' | 'review' | null;
    tool_steps: Array<{
      id: string;
      node: string;
      stage: string;
      tool: string;
      call_number: number;
      status: 'running' | 'success' | 'failed' | 'rejected';
      result_count: number;
      duration_ms: number | null;
      summary: string | null;
      error_code: string | null;
      created_at: string;
    }>;
  } | null;
  regeneration: {
    affected_artifacts: string[];
    source_ids: string[];
  } | null;
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
