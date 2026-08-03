import { KnowledgeClient } from '@/components/knowledge/knowledge-client';

export default async function KnowledgePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <KnowledgeClient projectId={projectId} />;
}
