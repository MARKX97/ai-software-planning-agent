'use client';

import Link from 'next/link';
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
  listArtifacts,
  type ArtifactType,
} from '@/features/artifacts/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/use-async';

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
  const state = useAsync(() => listArtifacts(projectId, type), [projectId, type]);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  async function handleExportPrd() {
    setExportStatus('创建导出任务中');
    try {
      const task = await exportPrd(projectId);
      const latest = await getExport(projectId, task.id);
      setExportStatus(`导出任务：${latest.status}`);
    } catch (error) {
      setExportStatus(error instanceof Error ? error.message : '导出失败');
    }
  }

  return (
    <PageFrame
      actions={
        <>
          <Button onClick={() => void handleExportPrd()} variant="secondary">
            导出 PRD
          </Button>
          <ButtonLink href={`/projects/${projectId}/usage`} variant="quiet">
            查看用量
          </ButtonLink>
        </>
      }
      description="浏览工作流生成的 11 类规划产物。列表只展示摘要，打开详情后再读取完整 Markdown。"
      eyebrow="Artifacts"
      title="规划产物"
    >
      {exportStatus ? (
        <p className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900" role="status">
          {exportStatus}
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

      {state.loading ? <ListSkeleton rows={6} /> : null}
      {state.error ? <ErrorState error={state.error} onRetry={state.reload} /> : null}
      {!state.loading && !state.error && state.data?.items.length === 0 ? (
        <EmptyState
          action={<ButtonLink href={`/projects/${projectId}/workflow`}>查看工作流</ButtonLink>}
          description="完成规划生成阶段后，这里会出现需求、风险、MVP、PRD、架构和编码规则等产物。"
          title="暂无产物"
        />
      ) : null}
      {!state.loading && !state.error && state.data?.items.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.data.items.map((artifact) => (
            <Link href={`/projects/${projectId}/artifacts/${artifact.id}`} key={artifact.id}>
              <Card className="h-full transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md">
                <CardBody className="flex h-full flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-bold leading-6 text-slate-950">{artifact.title}</h2>
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
