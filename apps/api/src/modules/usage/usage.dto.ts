import { z } from 'zod';
import type { ModelExecutionLog, TokenUsage } from '@ai-planning/database';

/**
 * Zod schemas + DTOs for the Usage endpoints.
 * Source: contracts/openapi.yaml → TokenUsageDetailResponse / ModelExecutionLogResponse.
 * @internal
 */
export const tokenUsageQuerySchema = z.object({
  project_id: z.string().uuid(),
});

export type TokenUsageQuery = z.infer<typeof tokenUsageQuerySchema>;

export const WORKFLOW_STAGES = [
  'init',
  'requirement_analysis',
  'requirement_clarification',
  'multi_model_analysis',
  'requirement_synthesis',
  'feasibility_analysis',
  'risk_analysis',
  'mvp_compression',
  'platform_recommendation',
  'planning_generation',
  'completed',
  'failed',
] as const;

export const listLogsQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  provider_name: z.enum(['deepseek', 'glm', 'minimax']).optional(),
  stage: z.enum(WORKFLOW_STAGES).optional(),
  status: z.enum(['success', 'failed', 'timeout', 'rate_limited']).optional(),
});

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;

const CALL_STATUSES = ['success', 'failed', 'timeout', 'rate_limited'] as const;

export interface WorkflowProgress {
  completed_stages: number;
  total_stages: number;
  percentage: number;
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

export interface ProviderBreakdown {
  provider_name: string;
  call_count: number;
  success_count: number;
  failed_count: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_latency_ms: number | null;
}

export interface StageBreakdown {
  stage: string;
  call_count: number;
  total_cost: number;
  avg_latency_ms: number | null;
}

export interface TokenUsageResponse {
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
}

export interface TokenUsageDetailResponse extends TokenUsageResponse {
  by_provider: ProviderBreakdown[];
  by_stage: StageBreakdown[];
  cost_limit: {
    max_cost_per_project: number;
    remaining: number;
    alert_triggered: boolean;
  };
}

export const CALL_STATUS_VALUES: readonly string[] = CALL_STATUSES;

/** Convert a Prisma ModelExecutionLog row to the API response shape. */
export function toModelExecutionLogResponse(log: ModelExecutionLog): ModelExecutionLogResponse {
  return {
    id: log.id,
    project_id: log.project_id,
    execution_id: log.execution_id,
    stage: log.stage,
    provider_name: log.provider_name,
    model_id: log.model_id,
    status: log.status,
    attempt_number: log.attempt_number,
    prompt_version_id: log.prompt_version_id,
    input_tokens: log.input_tokens,
    output_tokens: log.output_tokens,
    cost_input: Number(log.cost_input),
    cost_output: Number(log.cost_output),
    cost_total: Number(log.cost_total),
    latency_ms: log.latency_ms,
    error_code: log.error_code,
    error_message: log.error_message,
    created_at: log.created_at.toISOString(),
  };
}

/** Convert a Prisma ModelExecutionLog row to the detail response shape. */
export function toModelExecutionLogDetail(log: ModelExecutionLog): ModelExecutionLogDetailResponse {
  return {
    ...toModelExecutionLogResponse(log),
    prompt_text: log.prompt_text,
    response_text: log.response_text,
    structured_output: (log.structured_output as Record<string, unknown> | null) ?? null,
  };
}

/** Convert a Prisma TokenUsage row (or null) to the basic response shape. */
export function toTokenUsageResponse(
  projectId: string,
  usage: TokenUsage | null,
): TokenUsageResponse {
  const callCount = usage?.call_count ?? 0;
  const successCount = usage?.success_count ?? 0;
  const successRate = callCount > 0 ? Math.round((successCount / callCount) * 100 * 10) / 10 : null;
  return {
    project_id: projectId,
    total_input_tokens: usage?.total_input_tokens ?? 0,
    total_output_tokens: usage?.total_output_tokens ?? 0,
    total_tokens: usage?.total_tokens ?? 0,
    total_cost: usage ? Number(usage.total_cost) : 0,
    call_count: callCount,
    success_count: successCount,
    failed_count: usage?.failed_count ?? 0,
    timeout_count: usage?.timeout_count ?? 0,
    rate_limited_count: usage?.rate_limited_count ?? 0,
    avg_latency_ms: usage?.avg_latency_ms ?? null,
    success_rate: successRate,
    updated_at: (usage?.updated_at ?? new Date()).toISOString(),
  };
}
