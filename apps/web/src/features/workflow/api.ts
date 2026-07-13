import { apiRequest } from '@/lib/api-client';
import type {
  ConversationResponse,
  MessageListResponse,
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

export function listConversationMessages(
  projectId: string,
  conversationId: string,
): Promise<MessageListResponse> {
  return apiRequest<MessageListResponse>(
    `/projects/${projectId}/conversations/${conversationId}/messages`,
    { query: { offset: 0, limit: 100 } },
  );
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

export function discussWorkflow(
  projectId: string,
  conversationId: string,
  message: string,
): Promise<WorkflowStatusResponse> {
  return apiRequest<WorkflowStatusResponse>(`/projects/${projectId}/workflow/discuss`, {
    method: 'POST',
    body: { conversation_id: conversationId, message },
  });
}

export function advanceWorkflow(
  projectId: string,
  conversationId: string,
): Promise<WorkflowStatusResponse> {
  return apiRequest<WorkflowStatusResponse>(`/projects/${projectId}/workflow/advance`, {
    method: 'POST',
    body: { conversation_id: conversationId },
  });
}
