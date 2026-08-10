'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { PageFrame } from '@/components/layout/app-shell';
import { ErrorState } from '@/components/ui/feedback';
import { listArtifacts } from '@/features/artifacts/api';
import { ArtifactListContent } from './artifact-list-content';
import { useArtifactExport } from './use-artifact-export';

export function ArtifactsClient({ projectId }: { projectId: string }) {
  const [type, setType] = useState('');
  const artifactsQuery = useQuery({
    queryKey: ['artifacts', projectId, type],
    queryFn: () => listArtifacts(projectId, type),
  });
  const exportState = useArtifactExport(projectId);
  return (
    <PageFrame
      actions={exportState.actions}
      description="这里收着这次想明白后留下的东西：需求、取舍、风险和能交给团队继续做的方案。"
      eyebrow="这次留下了什么"
      title="已经整理好的内容"
    >
      {exportState.error ? (
        <ErrorState error={exportState.error} onRetry={exportState.retry} title="导出失败" />
      ) : null}
      {exportState.status || exportState.message ? (
        <p
          className="rounded-md border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm font-medium text-cyan-900"
          role="status"
        >
          {exportState.message ?? '正在准备导出文件。'}
        </p>
      ) : null}
      <ArtifactListContent
        data={artifactsQuery.data}
        error={artifactsQuery.error}
        isLoading={artifactsQuery.isLoading}
        onRetry={() => void artifactsQuery.refetch()}
        onTypeChange={setType}
        projectId={projectId}
        type={type}
      />
    </PageFrame>
  );
}
