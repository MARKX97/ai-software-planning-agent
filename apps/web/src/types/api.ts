import type { WorkflowStatusResponse } from './workflow-insights';

export type {
  ArtifactQualityCheck,
  ArtifactQualityReport,
  DecisionSnapshot,
  WorkflowProgress,
  WorkflowStateListResponse,
  WorkflowStateResponse,
  WorkflowStatusResponse,
} from './workflow-insights';

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, unknown>;
  readonly retryable?: boolean;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: Record<string, unknown>,
    retryable?: boolean,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.retryable = retryable;
  }
}

export interface ProjectResponse {
  id: string;
  name: string;
  original_idea: string;
  status: string;
  current_stage: string;
  requirement_text?: string | null;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectListResponse {
  items: ProjectResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface ModelExecutionLogResponse {
  id: string;
  project_id: string;
  execution_id: string | null;
  stage: string;
  provider_name: string;
  model_id: string;
  status: string;
  attempt_number: number;
  prompt_version_id: string | null;
  input_tokens: number;
  output_tokens: number;
  cost_input: number;
  cost_output: number;
  cost_total: number;
  latency_ms: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

export interface ModelExecutionLogDetailResponse extends ModelExecutionLogResponse {
  prompt_text: string;
  response_text: string | null;
  structured_output: Record<string, unknown> | null;
}

export interface ModelExecutionLogListResponse {
  items: ModelExecutionLogResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface ArtifactResponse {
  id: string;
  project_id: string;
  type: string;
  type_display_name: string;
  title: string;
  stage: string;
  content?: string | null;
  file_path: string | null;
  size_bytes: number | null;
  format: string;
  created_at: string;
}

export interface ArtifactListResponse {
  items: ArtifactResponse[];
  total: number;
}

export interface ExportResponse {
  id: string;
  project_id: string;
  format: string;
  status: string;
  artifact_count: number;
  file_path: string | null;
  file_size_bytes: number | null;
  download_url: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ConversationResponse {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MessageListResponse {
  items: MessageResponse[];
  total: number;
  offset: number;
  limit: number;
}

export interface WorkflowStreamResponse {
  assistant_message: MessageResponse;
  status: WorkflowStatusResponse;
}

export interface TokenUsageDetailResponse {
  project_id: string;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  total_cost: number;
  call_count: number;
  success_count: number;
  failed_count: number;
  timeout_count: number;
  rate_limited_count: number;
  avg_latency_ms: number | null;
  success_rate: number | null;
  updated_at: string;
  by_provider: Array<{
    provider_name: string;
    call_count: number;
    success_count: number;
    failed_count: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cost: number;
    avg_latency_ms: number | null;
  }>;
  by_stage: Array<{
    stage: string;
    call_count: number;
    total_cost: number;
    avg_latency_ms: number | null;
  }>;
  cost_limit: {
    max_cost_per_project: number;
    remaining: number;
    alert_triggered: boolean;
  };
}
