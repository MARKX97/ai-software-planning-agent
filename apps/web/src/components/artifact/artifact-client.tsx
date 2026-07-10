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
      setExportMessage(`导出任务：${task.status}`);
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
    mutationFn: () => getExportDownload(projectId, exportId ?? '', exportId ?? ''),
    onSuccess: (result) => {
      setExportMessage(`导出下载已准备：${result.status}`);
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
            {exportMutation.isPending ? '创建导出中' : '导出 PRD'}
          </Button>
          {exportComplete ? (
            <Button
              disabled={downloadExportMutation.isPending}
              onClick={() => downloadExportMutation.mutate()}
              variant="secondary"
            >
              {downloadExportMutation.isPending ? '准备下载中' : '下载导出'}
            </Button>
          ) : null}
          <ButtonLink href={`/projects/${projectId}/usage`} variant="quiet">
            查看用量
          </ButtonLink>
        </>
      }
      description="浏览工作流生成的 11 类规划产物。列表只展示摘要，打开详情后再读取完整 Markdown。"
      eyebrow="Artifacts"
      title="规划产物"
    >
      {exportError ? (
        <ErrorState error={exportError} onRetry={handleExportPrd} title="导出失败" />
      ) : null}
      {exportStatus || exportMessage ? (
        <p
          className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900"
          role="status"
        >
          {exportMessage ?? `导出任务：${exportStatus}`}
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
          action={<ButtonLink href={`/projects/${projectId}/workflow`}>查看工作流</ButtonLink>}
          description="完成规划生成阶段后，这里会出现需求、风险、MVP、PRD、架构和编码规则等产物。"
          title="暂无产物"
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
