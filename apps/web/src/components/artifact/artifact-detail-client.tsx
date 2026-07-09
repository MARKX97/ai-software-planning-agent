'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { downloadArtifact, getArtifact } from '@/features/artifacts/api';
import { formatBytes, formatDateTime } from '@/lib/format';

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
  const [downloadError, setDownloadError] = useState<string | null>(null);
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
    onError: (error) => {
      setDownloadError(error instanceof Error ? error.message : '下载失败');
    },
  });

  function handleDownload() {
    setDownloadError(null);
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
            {downloadMutation.isPending ? '下载中' : '下载 Markdown'}
          </Button>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="quiet">
            返回列表
          </ButtonLink>
        </>
      }
      description="完整产物以安全纯文本方式展示，避免把模型输出作为 HTML 注入页面。"
      eyebrow="Artifact Detail"
      title={artifact?.title ?? '产物详情'}
    >
      {downloadError ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          role="alert"
        >
          {downloadError}
        </p>
      ) : null}
      {artifactQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {artifactQuery.error ? (
        <ErrorState error={artifactQuery.error} onRetry={() => void artifactQuery.refetch()} />
      ) : null}
      {artifact ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardBody>
              <pre className="max-w-none whitespace-pre-wrap break-words font-mono text-sm leading-7 text-slate-800">
                {artifact.content ?? '该产物没有内容。'}
              </pre>
            </CardBody>
          </Card>
          <aside className="grid h-fit gap-3">
            <Card>
              <CardBody className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-600">类型</span>
                  <Badge>{artifact.type_display_name}</Badge>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-600">大小</span>
                  <span>{formatBytes(artifact.size_bytes)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-slate-600">生成时间</span>
                  <span>{formatDateTime(artifact.created_at)}</span>
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}
