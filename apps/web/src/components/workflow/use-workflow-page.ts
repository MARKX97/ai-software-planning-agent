import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getWorkflowStatus,
  listConversationMessages,
  listWorkflowStates,
} from '@/features/workflow/api';
import type {
  MessageListResponse,
  WorkflowStatusResponse,
  WorkflowStreamResponse,
} from '@/types/api';

export function useWorkflowPage(projectId: string) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['workflow-status', projectId],
    queryFn: () => getWorkflowStatus(projectId),
    refetchInterval: (query) => refreshInterval(query.state.data),
  });
  const statesQuery = useQuery({
    queryKey: ['workflow-states', projectId],
    queryFn: () => listWorkflowStates(projectId),
    refetchInterval: () => refreshInterval(statusQuery.data),
  });
  const conversationId = statusQuery.data?.conversation_id ?? null;
  const messagesQuery = useQuery({
    enabled: Boolean(conversationId),
    queryKey: ['conversation-messages', projectId, conversationId],
    queryFn: () => listConversationMessages(projectId, conversationId ?? ''),
  });
  function sync(result: WorkflowStreamResponse): void {
    queryClient.setQueryData(['workflow-status', projectId], result.status);
    queryClient.setQueryData<MessageListResponse>(
      ['conversation-messages', projectId, result.assistant_message.conversation_id],
      (current) => appendMessage(current, result),
    );
  }
  async function refresh(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workflow-status', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['workflow-states', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', projectId] }),
    ]);
  }
  return { conversationId, messagesQuery, refresh, statesQuery, statusQuery, sync };
}

function refreshInterval(data?: WorkflowStatusResponse): number | false {
  return data?.status === 'active' &&
    !['requirement_clarification', 'completed', 'failed'].includes(data.current_stage)
    ? 3000
    : false;
}

function appendMessage(
  current: MessageListResponse | undefined,
  result: WorkflowStreamResponse,
): MessageListResponse {
  const items = current?.items ?? [];
  const next = items.some((message) => message.id === result.assistant_message.id)
    ? items
    : [...items, result.assistant_message];
  return { items: next, total: next.length, offset: 0, limit: 100 };
}
