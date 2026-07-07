import { ArtifactDetailClient } from '@/components/artifact/artifact-detail-client';

export default async function ArtifactDetailPage({
  params,
}: {
  params: Promise<{ artifactId: string; projectId: string }>;
}) {
  const { artifactId, projectId } = await params;
  return <ArtifactDetailClient artifactId={artifactId} projectId={projectId} />;
}
