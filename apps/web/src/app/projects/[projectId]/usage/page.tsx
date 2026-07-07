import { UsageClient } from '@/components/usage/usage-client';

export default async function UsagePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  return <UsageClient projectId={projectId} />;
}
