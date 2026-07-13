import { WorkflowClient } from '@/components/workflow/workflow-client';

export default async function WorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ start?: string }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;
  return <WorkflowClient autoStart={query.start === '1'} projectId={projectId} />;
}
