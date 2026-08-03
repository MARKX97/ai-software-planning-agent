'use client';

import { useQuery } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/app-shell';
import { KnowledgeSourceCard } from '@/components/knowledge/knowledge-source-card';
import { KnowledgeUploadCard } from '@/components/knowledge/knowledge-upload-card';
import { useKnowledgeMutations } from '@/components/knowledge/use-knowledge-mutations';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { listKnowledgeSources } from '@/features/knowledge/api';
import type { KnowledgeSourceResponse } from '@/types/api';

export function KnowledgeClient({ projectId }: { projectId: string }) {
  const sources = useQuery({
    queryKey: ['knowledge-sources', projectId],
    queryFn: () => listKnowledgeSources(projectId),
    refetchInterval: (query) =>
      query.state.data?.items.some(({ status }) => status === 'pending' || status === 'processing')
        ? 2000
        : false,
  });
  const actions = useKnowledgeMutations(projectId);
  const handleDelete = (sourceId: string) => {
    if (window.confirm('删除后它不会参与新的规划，但已有引用快照会保留。确定删除吗？')) {
      actions.remove.mutate(sourceId);
    }
  };

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}`} variant="secondary">
            回到项目
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="quiet">
            查看产物
          </ButtonLink>
        </>
      }
      description="把已经确定的背景、约束和规则放在这里。规划会从这些资料里寻找证据，并在产物中留下引用。"
      eyebrow="项目证据"
      title="项目资料库"
    >
      <KnowledgeUploadCard busy={actions.upload.isPending} onUpload={actions.upload.mutateAsync} />
      <KnowledgeFeedback error={actions.error} message={actions.message} />
      <KnowledgeSourceList
        busyId={actions.busyId}
        error={sources.error}
        items={sources.data?.items}
        loading={sources.isLoading}
        onDelete={handleDelete}
        onReindex={(id) => actions.reindex.mutate(id)}
        onRetry={() => void sources.refetch()}
      />
    </PageFrame>
  );
}

function KnowledgeSourceList({
  items,
  loading,
  error,
  busyId,
  onRetry,
  onDelete,
  onReindex,
}: {
  items?: KnowledgeSourceResponse[];
  loading: boolean;
  error: Error | null;
  busyId?: string;
  onRetry: () => void;
  onDelete: (id: string) => void;
  onReindex: (id: string) => void;
}) {
  if (loading) return <ListSkeleton rows={3} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!items?.length) {
    return (
      <EmptyState
        description="先上传一份产品说明、约束清单或技术背景，后续 PRD 和架构产物就能引用它。"
        title="还没有项目资料"
      />
    );
  }
  return (
    <section aria-label="项目资料" className="grid gap-3">
      {items.map((source) => (
        <KnowledgeSourceCard
          busy={busyId === source.id}
          key={source.id}
          onDelete={() => onDelete(source.id)}
          onReindex={() => onReindex(source.id)}
          source={source}
        />
      ))}
    </section>
  );
}

function KnowledgeFeedback({ error, message }: { error: Error | null; message: string | null }) {
  return (
    <>
      {message ? (
        <p
          aria-live="polite"
          className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? <ErrorState error={error} title="资料操作失败" /> : null}
    </>
  );
}
