'use client';

import { PageFrame } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { useWorkflowActions } from '@/components/workflow/use-workflow-actions';
import { getUserErrorMessage } from '@/lib/api-client';
import { useWorkflowPage } from './use-workflow-page';
import { WorkflowPageContent } from './workflow-page-content';

interface WorkflowClientProps {
  projectId: string;
  autoStart?: boolean;
}

export function WorkflowClient({ projectId, autoStart = false }: WorkflowClientProps) {
  const page = useWorkflowPage(projectId);
  const status = page.statusQuery.data;
  const actions = useWorkflowActions({
    autoStart,
    projectId,
    conversationId: page.conversationId,
    status,
    onDone: page.sync,
    refresh: page.refresh,
  });
  const failureMessage = status?.error_message
    ? getUserErrorMessage(status.error_message, '工作流执行失败，请稍后重试。')
    : null;

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
      <WorkflowPageContent actions={actions} failureMessage={failureMessage} page={page} />
    </PageFrame>
  );
}
