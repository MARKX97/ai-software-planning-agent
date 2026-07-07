import { WorkflowClient } from '@/components/workflow/workflow-client';

export default async function WorkflowPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <WorkflowClient projectId={projectId} />;
}
