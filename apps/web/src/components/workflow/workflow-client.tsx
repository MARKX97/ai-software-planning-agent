'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { PageFrame } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ClarificationConversation } from '@/components/workflow/clarification-conversation';
import { StageRail } from '@/components/workflow/stage-rail';
import { WorkflowStatusPanels } from '@/components/workflow/workflow-status-panels';
import {
  advanceWorkflow,
  continueWorkflow,
  discussWorkflow,
  getWorkflowStatus,
  listConversationMessages,
  listWorkflowStates,
  runWorkflow,
} from '@/features/workflow/api';
import { getUserErrorMessage } from '@/lib/api-client';

export function WorkflowClient({ projectId }: { projectId: string }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
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
  const failureMessage = status?.error_message
    ? getUserErrorMessage(status.error_message, '工作流执行失败，请稍后重试。')
    : null;

  async function startWorkflow() {
    setBusy(true);
    setActionError(null);
    try {
      await runWorkflow(projectId);
      await refreshWorkflow();
    } catch (error) {
      setActionError(getUserErrorMessage(error, '工作流启动失败，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  }

  async function submitClarification() {
    if (answer.trim().length === 0) {
      setActionError('请输入澄清回复。');
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      if (!conversationId || !status?.waiting_for) throw new Error('当前没有可继续的讨论。');
      const submit = status.waiting_for === 'reply' ? continueWorkflow : discussWorkflow;
      await submit(projectId, conversationId, answer.trim());
      setAnswer('');
      await refreshWorkflow();
    } catch (error) {
      setActionError(getUserErrorMessage(error, '回复提交失败，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  }

  async function advanceCheckpoint() {
    setBusy(true);
    setActionError(null);
    try {
      if (!conversationId) throw new Error('当前没有可确认的讨论。');
      await advanceWorkflow(projectId, conversationId);
      await refreshWorkflow();
    } catch (error) {
      setActionError(getUserErrorMessage(error, '暂时无法进入下一环节，请稍后重试。'));
    } finally {
      setBusy(false);
    }
  }

  async function refreshWorkflow() {
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
              actionError={actionError}
              busy={busy}
              failureMessage={failureMessage}
              onStart={() => void startWorkflow()}
              status={status}
            />

            {conversationId ? (
              <ClarificationConversation
                actionError={actionError}
                answer={answer}
                busy={busy}
                canAdvance={status.waiting_for === 'review' && Boolean(status.next_stage)}
                canReply={Boolean(status.waiting_for)}
                currentQuestions={status.clarification_questions ?? []}
                historyError={messagesQuery.error}
                isLoading={messagesQuery.isLoading}
                messages={messagesQuery.data?.items ?? []}
                onAnswerChange={setAnswer}
                onAdvance={() => void advanceCheckpoint()}
                onRetryHistory={() => void messagesQuery.refetch()}
                onSubmit={() => void submitClarification()}
                stageName={status.stage_display_name}
              />
            ) : null}
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}
