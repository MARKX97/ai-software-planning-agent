'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageFrame } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import {
  ARTIFACT_TYPES,
  exportPrd,
  getExport,
  getExportDownload,
  listArtifacts,
  type ArtifactType,
} from '@/features/artifacts/api';
import { formatBytes, formatDateTime } from '@/lib/format';

const displayNames: Record<ArtifactType, string> = {
  requirement_report: '需求报告',
  feasibility_report: '可行性报告',
  risk_report: '风险报告',
  mvp_plan: 'MVP 计划',
  platform_recommendation: '平台推荐',
  project_plan: '项目计划',
  prd: 'PRD',
  architecture: '架构设计',
  frontend_spec: '前端规格',
  backend_spec: '后端规格',
  ai_coding_rules: 'AI 编码规则',
};

export function ArtifactsClient({ projectId }: { projectId: string }) {
  const [type, setType] = useState('');
  const [exportId, setExportId] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const artifactsQuery = useQuery({
    queryKey: ['artifacts', projectId, type],
    queryFn: () => listArtifacts(projectId, type),
  });
  const exportMutation = useMutation({
    mutationFn: () => exportPrd(projectId),
    onSuccess: (task) => {
      setExportId(task.id);
      setExportMessage('正在把 PRD 打包好，请稍等一会儿。');
    },
  });
  const exportQuery = useQuery({
    enabled: Boolean(exportId),
    queryKey: ['export', projectId, exportId],
    queryFn: () => getExport(projectId, exportId ?? ''),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'pending' || status === 'processing' ? 2000 : false;
    },
  });
  const downloadExportMutation = useMutation({
    mutationFn: () =>
      getExportDownload(projectId, exportId ?? '', exportQuery.data?.download_url ?? ''),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'planning-export.md';
      link.click();
      window.URL.revokeObjectURL(url);
      setExportMessage('文件已经准备好了，可以下载。');
    },
  });
  const exportStatus = exportQuery.data?.status ?? (exportMutation.isPending ? 'creating' : null);
  const exportComplete = exportQuery.data?.status === 'completed';
  const exportError =
    exportMutation.error ?? exportQuery.error ?? downloadExportMutation.error ?? null;

  function handleExportPrd() {
    setExportMessage(null);
    setExportId(null);
    exportMutation.mutate();
  }

  return (
    <PageFrame
      actions={
        <>
          <Button disabled={exportMutation.isPending} onClick={handleExportPrd} variant="secondary">
            {exportMutation.isPending ? '正在打包' : '打包成 PRD'}
          </Button>
          {exportComplete ? (
            <Button
              disabled={downloadExportMutation.isPending}
              onClick={() => downloadExportMutation.mutate()}
              variant="secondary"
            >
              {downloadExportMutation.isPending ? '正在准备下载' : '下载文件'}
            </Button>
          ) : null}
          <ButtonLink href={`/projects/${projectId}/usage`} variant="quiet">
            看看这次花了多少
          </ButtonLink>
        </>
      }
      description="这里收着这次想明白后留下的东西：需求、取舍、风险和能交给团队继续做的方案。"
      eyebrow="这次留下了什么"
      title="已经整理好的内容"
    >
      {exportError ? (
        <ErrorState error={exportError} onRetry={handleExportPrd} title="导出失败" />
      ) : null}
      {exportStatus || exportMessage ? (
        <p
          className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900"
          role="status"
        >
          {exportMessage ?? '正在准备导出文件。'}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${
            type === '' ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white'
          }`}
          onClick={() => setType('')}
          type="button"
        >
          全部
        </button>
        {ARTIFACT_TYPES.map((artifactType) => (
          <button
            className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${
              type === artifactType
                ? 'border-slate-950 bg-slate-950 text-white'
                : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
            }`}
            key={artifactType}
            onClick={() => setType(artifactType)}
            type="button"
          >
            {displayNames[artifactType]}
          </button>
        ))}
      </div>

      {artifactsQuery.isLoading ? <ListSkeleton rows={6} /> : null}
      {artifactsQuery.error ? (
        <ErrorState error={artifactsQuery.error} onRetry={() => void artifactsQuery.refetch()} />
      ) : null}
      {!artifactsQuery.isLoading &&
      !artifactsQuery.error &&
      artifactsQuery.data?.items.length === 0 ? (
        <EmptyState
          action={<ButtonLink href={`/projects/${projectId}/workflow`}>回到进展页</ButtonLink>}
          description="等这次梳理走到最后，需求、风险、MVP 和可以交给团队的计划都会放在这里。"
          title="还在整理中"
        />
      ) : null}
      {!artifactsQuery.isLoading && !artifactsQuery.error && artifactsQuery.data?.items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {artifactsQuery.data.items.map((artifact) => (
            <Link href={`/projects/${projectId}/artifacts/${artifact.id}`} key={artifact.id}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md">
                <CardBody className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-bold leading-6 text-slate-950">
                      {artifact.title}
                    </h2>
                    <Badge>{artifact.format}</Badge>
                  </div>
                  <p className="text-sm text-slate-600">{artifact.type_display_name}</p>
                  <div className="mt-auto flex flex-wrap gap-3 text-xs font-medium text-slate-500">
                    <span>{formatBytes(artifact.size_bytes)}</span>
                    <span>{formatDateTime(artifact.created_at)}</span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      ) : null}
    </PageFrame>
  );
}
