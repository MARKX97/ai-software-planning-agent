'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { downloadArtifact, getArtifact } from '@/features/artifacts/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import type { ArtifactCitation, ArtifactResponse } from '@/types/api';

export function ArtifactDetailClient({
  projectId,
  artifactId,
}: {
  projectId: string;
  artifactId: string;
}) {
  const artifactQuery = useQuery({
    queryKey: ['artifact', projectId, artifactId],
    queryFn: () => getArtifact(projectId, artifactId),
  });
  const artifact = artifactQuery.data;
  const downloadMutation = useMutation({
    mutationFn: () => downloadArtifact(projectId, artifactId),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${artifact?.type ?? 'artifact'}.md`;
      link.click();
      window.URL.revokeObjectURL(url);
    },
  });

  function handleDownload() {
    downloadMutation.mutate();
  }

  return (
    <PageFrame
      actions={
        <>
          <Button
            disabled={downloadMutation.isPending}
            onClick={handleDownload}
            variant="secondary"
          >
            {downloadMutation.isPending ? '正在准备下载' : '下载这份内容'}
          </Button>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="quiet">
            回到全部内容
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/knowledge`} variant="quiet">
            项目资料
          </ButtonLink>
        </>
      }
      description="这是这次讨论留下的完整记录。你可以直接阅读，或下载下来交给接手的人继续做。"
      eyebrow="一份整理好的内容"
      title={artifact?.title ?? '正在打开内容'}
    >
      {downloadMutation.error ? (
        <ErrorState error={downloadMutation.error} onRetry={handleDownload} title="下载失败" />
      ) : null}
      {artifactQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {artifactQuery.error ? (
        <ErrorState error={artifactQuery.error} onRetry={() => void artifactQuery.refetch()} />
      ) : null}
      {artifact ? <ArtifactBody artifact={artifact} /> : null}
    </PageFrame>
  );
}

function ArtifactBody({ artifact }: { artifact: ArtifactResponse }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardBody>
          <pre className="max-w-none whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-800">
            {artifact.content ?? '这份内容暂时还是空的。'}
          </pre>
        </CardBody>
      </Card>
      <aside className="grid h-fit gap-3">
        <ArtifactMetadata artifact={artifact} />
        <ArtifactCitations citations={artifact.citations ?? []} />
      </aside>
    </div>
  );
}

function ArtifactMetadata({ artifact }: { artifact: ArtifactResponse }) {
  return (
    <Card>
      <CardBody className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-600">这是什么</span>
          <Badge>{artifact.type_display_name}</Badge>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-600">文件大小</span>
          <span>{formatBytes(artifact.size_bytes)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="font-semibold text-slate-600">整理时间</span>
          <span>{formatDateTime(artifact.created_at)}</span>
        </div>
      </CardBody>
    </Card>
  );
}

function ArtifactCitations({ citations }: { citations: ArtifactCitation[] }) {
  return (
    <Card>
      <CardBody>
        <h2 className="text-sm font-bold text-slate-950">引用依据</h2>
        {citations.length ? (
          <div className="mt-3 grid gap-2">
            {citations.map((citation) => (
              <details
                className="rounded-md border border-slate-200 bg-slate-50"
                key={citation.citationKey}
              >
                <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">
                  [{citation.citationKey}] {citation.title}
                </summary>
                <div className="border-t border-slate-200 px-3 py-3 text-sm">
                  <p className="font-medium text-cyan-800">{citation.locator}</p>
                  <p className="mt-2 whitespace-pre-wrap leading-6 text-slate-700">
                    {citation.excerpt}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">生成时保存的证据快照</p>
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm leading-6 text-slate-600">这份内容没有项目资料引用。</p>
        )}
      </CardBody>
    </Card>
  );
}
