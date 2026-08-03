import { apiRequest } from '@/lib/api-client';
import { apiEventStream } from '@/lib/sse-client';
import type {
  ConversationResponse,
  MessageListResponse,
  WorkflowStateListResponse,
  WorkflowStatusResponse,
  WorkflowStreamResponse,
} from '@/types/api';

export interface WorkflowStreamCallbacks {
  readonly onDelta: (content: string) => void;
  readonly signal?: AbortSignal;
}

export interface WorkflowMessageStreamInput extends WorkflowStreamCallbacks {
  readonly conversationId: string;
  readonly message: string;
}

export interface WorkflowResumeStreamInput extends WorkflowMessageStreamInput {
  readonly graphRunId?: string;
  readonly checkpointVersion?: number;
}

export function runWorkflow(
  projectId: string,
  callbacks: WorkflowStreamCallbacks,
): Promise<WorkflowStreamResponse> {
  return apiEventStream<WorkflowStreamResponse>(`/projects/${projectId}/run`, {
    method: 'POST',
    body: {},
    ...callbacks,
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
  input: WorkflowResumeStreamInput,
): Promise<WorkflowStreamResponse> {
  return apiEventStream<WorkflowStreamResponse>(`/projects/${projectId}/workflow/continue`, {
    method: 'POST',
    body: {
      conversation_id: input.conversationId,
      message: input.message,
      ...(input.graphRunId
        ? { graph_run_id: input.graphRunId, checkpoint_version: input.checkpointVersion }
        : {}),
    },
    onDelta: input.onDelta,
    signal: input.signal,
  });
}

export function discussWorkflow(
  projectId: string,
  input: WorkflowMessageStreamInput,
): Promise<WorkflowStreamResponse> {
  return apiEventStream<WorkflowStreamResponse>(`/projects/${projectId}/workflow/discuss`, {
    method: 'POST',
    body: { conversation_id: input.conversationId, message: input.message },
    onDelta: input.onDelta,
    signal: input.signal,
  });
}

export function advanceWorkflow(input: {
  projectId: string;
  conversationId: string;
  graphRunId?: string;
  checkpointVersion?: number;
}): Promise<WorkflowStatusResponse> {
  return apiRequest<WorkflowStatusResponse>(`/projects/${input.projectId}/workflow/advance`, {
    method: 'POST',
    body: {
      conversation_id: input.conversationId,
      ...(input.graphRunId
        ? { graph_run_id: input.graphRunId, checkpoint_version: input.checkpointVersion }
        : {}),
    },
  });
}
