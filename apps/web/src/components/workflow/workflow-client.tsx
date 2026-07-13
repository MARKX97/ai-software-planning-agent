'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ClarificationConversation } from '@/components/workflow/clarification-conversation';
import { StageRail } from '@/components/workflow/stage-rail';
import { WorkflowStatusPanels } from '@/components/workflow/workflow-status-panels';
import { useWorkflowActions } from '@/components/workflow/use-workflow-actions';
import {
  getWorkflowStatus,
  listConversationMessages,
  listWorkflowStates,
} from '@/features/workflow/api';
import { getUserErrorMessage } from '@/lib/api-client';
import type { MessageListResponse, WorkflowStreamResponse } from '@/types/api';

export function WorkflowClient({
  projectId,
  autoStart = false,
}: {
  projectId: string;
  autoStart?: boolean;
}) {
  const queryClient = useQueryClient();
  const statusQuery = useQuery({
    queryKey: ['workflow-status', projectId],
    queryFn: () => getWorkflowStatus(projectId),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data?.status === 'active' &&
        data.current_stage !== 'requirement_clarification' &&
        data.current_stage !== 'completed' &&
        data.current_stage !== 'failed'
      ) {
        return 3000;
      }
      return false;
    },
  });
  const statesQuery = useQuery({
    queryKey: ['workflow-states', projectId],
    queryFn: () => listWorkflowStates(projectId),
    refetchInterval: () => {
      const data = statusQuery.data;
      if (
        data?.status === 'active' &&
        data.current_stage !== 'requirement_clarification' &&
        data.current_stage !== 'completed' &&
        data.current_stage !== 'failed'
      ) {
        return 3000;
      }
      return false;
    },
  });
  const conversationId = statusQuery.data?.conversation_id ?? null;
  const messagesQuery = useQuery({
    enabled: Boolean(conversationId),
    queryKey: ['conversation-messages', projectId, conversationId],
    queryFn: () => listConversationMessages(projectId, conversationId ?? ''),
  });
  const status = statusQuery.data;
  const actions = useWorkflowActions({
    autoStart,
    projectId,
    conversationId,
    status,
    onDone: syncStreamResult,
    refresh: refreshWorkflow,
  });
  const failureMessage = status?.error_message
    ? getUserErrorMessage(status.error_message, '工作流执行失败，请稍后重试。')
    : null;

  function syncStreamResult(result: WorkflowStreamResponse): void {
    queryClient.setQueryData(['workflow-status', projectId], result.status);
    queryClient.setQueryData<MessageListResponse>(
      ['conversation-messages', projectId, result.assistant_message.conversation_id],
      (current) => {
        const items = current?.items ?? [];
        const exists = items.some((message) => message.id === result.assistant_message.id);
        const next = exists ? items : [...items, result.assistant_message];
        return { items: next, total: next.length, offset: 0, limit: 100 };
      },
    );
  }

  async function refreshWorkflow(): Promise<void> {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['workflow-status', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['workflow-states', projectId] }),
      queryClient.invalidateQueries({ queryKey: ['conversation-messages', projectId] }),
    ]);
  }

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}`} variant="secondary">
            项目概览
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
            产物
          </ButtonLink>
        </>
      }
      description="这里会把进展摊开给你看。需要你补一句时，我们会停下来等你，不会悄悄替你做决定。"
      eyebrow="一起把事情想明白"
      title="项目进展"
    >
      {statusQuery.isLoading || statesQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {statusQuery.error ? (
        <ErrorState error={statusQuery.error} onRetry={() => void statusQuery.refetch()} />
      ) : null}
      {statesQuery.error ? (
        <ErrorState
          error={statesQuery.error}
          onRetry={() => void statesQuery.refetch()}
          title="进展加载失败"
        />
      ) : null}
      {status ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <StageRail status={status} states={statesQuery.data?.items ?? []} />
          <aside className="grid h-fit gap-4">
            <WorkflowStatusPanels
              actionError={actions.actionError}
              busy={actions.busy}
              failureMessage={failureMessage}
              onStart={() => void actions.startWorkflow()}
              status={status}
            />

            {conversationId || actions.streamingReply !== null ? (
              <ClarificationConversation
                actionError={actions.actionError}
                answer={actions.answer}
                busy={actions.busy}
                canAdvance={status.waiting_for === 'review' && Boolean(status.next_stage)}
                canReply={Boolean(status.waiting_for)}
                currentQuestions={status.clarification_questions ?? []}
                historyError={messagesQuery.error}
                isLoading={messagesQuery.isLoading}
                messages={messagesQuery.data?.items ?? []}
                onAnswerChange={actions.setAnswer}
                onAdvance={() => void actions.advanceCheckpoint()}
                onRetryHistory={() => void messagesQuery.refetch()}
                onSubmit={() => void actions.submitReply()}
                pendingUserMessage={actions.pendingUserMessage}
                stageName={status.stage_display_name}
                streamingReply={actions.streamingReply}
              />
            ) : null}
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}
