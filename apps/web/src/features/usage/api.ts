import { apiRequest } from '@/lib/api-client';
import type { ModelExecutionLogListResponse, TokenUsageDetailResponse } from '@/types/api';

export function getTokenUsage(projectId: string): Promise<TokenUsageDetailResponse> {
  return apiRequest<TokenUsageDetailResponse>('/usage/tokens', {
    query: { project_id: projectId },
  });
}

export function listModelLogs(
  projectId: string,
  offset = 0,
  limit = 20,
): Promise<ModelExecutionLogListResponse> {
  return apiRequest<ModelExecutionLogListResponse>(`/projects/${projectId}/usage/logs`, {
    query: { offset, limit },
  });
}
