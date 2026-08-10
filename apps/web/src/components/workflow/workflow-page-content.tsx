import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ClarificationConversation } from './clarification-conversation';
import { StageRail } from './stage-rail';
import type { WorkflowActions } from './use-workflow-actions';
import type { useWorkflowPage } from './use-workflow-page';
import { WorkflowStatusPanels } from './workflow-status-panels';

interface WorkflowPageContentProps {
  actions: WorkflowActions;
  failureMessage: string | null;
  page: ReturnType<typeof useWorkflowPage>;
}

export function WorkflowPageContent(props: WorkflowPageContentProps) {
  const { page } = props;
  const status = page.statusQuery.data;
  return (
    <>
      {page.statusQuery.isLoading || page.statesQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {page.statusQuery.error ? (
        <ErrorState
          error={page.statusQuery.error}
          onRetry={() => void page.statusQuery.refetch()}
        />
      ) : null}
      {page.statesQuery.error ? (
        <ErrorState
          error={page.statesQuery.error}
          onRetry={() => void page.statesQuery.refetch()}
          title="进展加载失败"
        />
      ) : null}
      {status ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <StageRail status={status} states={page.statesQuery.data?.items ?? []} />
          <WorkflowSidebar {...props} />
        </div>
      ) : null}
    </>
  );
}

function WorkflowSidebar({ actions, failureMessage, page }: WorkflowPageContentProps) {
  const status = page.statusQuery.data;
  if (!status) return null;
  return (
    <aside className="grid h-fit gap-4">
      <WorkflowStatusPanels
        actionError={actions.actionError}
        busy={actions.busy}
        failureMessage={failureMessage}
        onStart={() => void actions.startWorkflow()}
        onRegenerate={() => void actions.regenerateArtifacts()}
        status={status}
      />
      {page.conversationId || actions.streamingReply !== null ? (
        <ClarificationConversation
          actionError={actions.actionError}
          answer={actions.answer}
          busy={actions.busy}
          canAdvance={status.waiting_for === 'review' && Boolean(status.next_stage)}
          canReply={Boolean(status.waiting_for)}
          currentQuestions={status.clarification_questions ?? []}
          historyError={page.messagesQuery.error}
          isLoading={page.messagesQuery.isLoading}
          messages={page.messagesQuery.data?.items ?? []}
          onAnswerChange={actions.setAnswer}
          onAdvance={() => void actions.advanceCheckpoint()}
          onRetryHistory={() => void page.messagesQuery.refetch()}
          onSubmit={() => void actions.submitReply()}
          pendingUserMessage={actions.pendingUserMessage}
          stageName={status.stage_display_name}
          streamingReply={actions.streamingReply}
        />
      ) : null}
    </aside>
  );
}
