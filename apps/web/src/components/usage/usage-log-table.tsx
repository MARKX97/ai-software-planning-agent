'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { getModelLogDetail, listModelLogs } from '@/features/usage/api';
import { UsageLogsContent } from './usage-logs-content';

const PAGE_SIZE = 20;

export function UsageLogTable({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const logsQuery = useQuery({
    queryKey: ['usage-logs', projectId, offset, PAGE_SIZE],
    queryFn: () => listModelLogs(projectId, offset, PAGE_SIZE),
  });
  const detailQuery = useQuery({
    enabled: Boolean(selectedLogId),
    queryKey: ['usage-log-detail', projectId, selectedLogId],
    queryFn: () => getModelLogDetail(projectId, selectedLogId ?? ''),
  });
  const logs = logsQuery.data;

  function changePage(nextOffset: number) {
    setSelectedLogId(null);
    setOffset(nextOffset);
  }

  return (
    <Card>
      <CardHeader>
        <UsageLogHeader
          canGoBack={offset > 0}
          canGoForward={Boolean(logs && offset + PAGE_SIZE < logs.total)}
          onBack={() => changePage(Math.max(0, offset - PAGE_SIZE))}
          onForward={() => changePage(offset + PAGE_SIZE)}
        />
      </CardHeader>
      <CardBody>
        <UsageLogsContent
          detail={detailQuery.data}
          detailError={detailQuery.error}
          detailLoading={detailQuery.isLoading}
          error={logsQuery.error}
          isLoading={logsQuery.isLoading}
          logs={logs}
          onRetryDetail={() => void detailQuery.refetch()}
          onRetryLogs={() => void logsQuery.refetch()}
          onSelect={setSelectedLogId}
          selectedLogId={selectedLogId}
        />
      </CardBody>
    </Card>
  );
}

function UsageLogHeader({
  canGoBack,
  canGoForward,
  onBack,
  onForward,
}: {
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-base font-bold text-slate-950">每一次调用</h2>
      <div className="flex gap-2">
        <Button disabled={!canGoBack} onClick={onBack} variant="secondary">
          上一页
        </Button>
        <Button disabled={!canGoForward} onClick={onForward} variant="secondary">
          下一页
        </Button>
      </div>
    </div>
  );
}
