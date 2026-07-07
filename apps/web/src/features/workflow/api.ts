import { apiRequest } from '@/lib/api-client';
import type {
  ConversationResponse,
  WorkflowStateListResponse,
  WorkflowStatusResponse,
} from '@/types/api';

export function runWorkflow(projectId: string): Promise<WorkflowStatusResponse> {
  return apiRequest<WorkflowStatusResponse>(`/projects/${projectId}/run`, {
    method: 'POST',
    body: {},
  });
}

export function getWorkflowStatus(projectId: string): Promise<WorkflowStatusResponse> {
  return apiRequest<WorkflowStatusResponse>(`/projects/${projectId}/workflow/status`);
}

export function listWorkflowStates(projectId: string): Promise<WorkflowStateListResponse> {
  return apiRequest<WorkflowStateListResponse>(`/projects/${projectId}/workflow/states`);
}

export function createConversation(projectId: string): Promise<ConversationResponse> {
  return apiRequest<ConversationResponse>(`/projects/${projectId}/conversations`, {
    method: 'POST',
    body: {},
  });
}

export function continueWorkflow(
  projectId: string,
  conversationId: string,
  message: string,
): Promise<WorkflowStatusResponse> {
  return apiRequest<WorkflowStatusResponse>(`/projects/${projectId}/workflow/continue`, {
    method: 'POST',
    body: { conversation_id: conversationId, message },
  });
}
