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
