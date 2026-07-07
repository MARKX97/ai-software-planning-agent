import { ArtifactsClient } from '@/components/artifact/artifact-client';

export default async function ArtifactsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <ArtifactsClient projectId={projectId} />;
}
