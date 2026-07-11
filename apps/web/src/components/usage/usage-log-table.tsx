'use client';

import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { stageName, statusName } from '@/components/project/project-status';
import { getModelLogDetail, listModelLogs } from '@/features/usage/api';
import { getUserErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-950">每一次调用</h2>
          <div className="flex gap-2">
            <Button
              disabled={offset === 0}
              onClick={() => changePage(Math.max(0, offset - PAGE_SIZE))}
              variant="secondary"
            >
              上一页
            </Button>
            <Button
              disabled={!logs || offset + PAGE_SIZE >= logs.total}
              onClick={() => changePage(offset + PAGE_SIZE)}
              variant="secondary"
            >
              下一页
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {logsQuery.isLoading ? <p className="text-sm text-slate-500">正在读取调用记录...</p> : null}
        {logsQuery.error ? (
          <InlineError error={logsQuery.error} onRetry={() => void logsQuery.refetch()} />
        ) : null}
        {!logsQuery.isLoading && !logsQuery.error && logs?.items.length === 0 ? (
          <p className="text-sm text-slate-600">这里还没有记录。</p>
        ) : null}
        {logs?.items.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500">
                  <th className="py-3 pr-4">参与者</th>
                  <th className="py-3 pr-4">在做什么</th>
                  <th className="py-3 pr-4">结果</th>
                  <th className="py-3 pr-4">用量</th>
                  <th className="py-3 pr-4">花费</th>
                  <th className="py-3 pr-4">时间</th>
                  <th className="py-3 pr-4">细节</th>
                </tr>
              </thead>
              <tbody>
                {logs.items.map((log) => {
                  const selected = selectedLogId === log.id;
                  return (
                    <Fragment key={log.id}>
                      <tr className={selected ? 'bg-cyan-50' : 'border-b border-slate-100'}>
                        <td className="py-3 pr-4 font-semibold text-slate-900">
                          {log.provider_name}
                        </td>
                        <td className="py-3 pr-4 text-slate-700">{stageName(log.stage)}</td>
                        <td className="py-3 pr-4">
                          <Badge variant={statusVariant(log.status)}>
                            {statusName(log.status)}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 font-mono text-slate-700">
                          {formatNumber(log.input_tokens + log.output_tokens)}
                        </td>
                        <td className="py-3 pr-4 font-mono text-slate-700">
                          {formatCurrency(log.cost_total)}
                        </td>
                        <td className="py-3 pr-4 text-slate-600">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="py-3 pr-4">
                          <Button
                            aria-expanded={selected}
                            onClick={() => setSelectedLogId(selected ? null : log.id)}
                            variant="quiet"
                          >
                            {selected ? '收起' : '看看细节'}
                          </Button>
                        </td>
                      </tr>
                      {selected ? (
                        <tr>
                          <td className="border-b border-slate-200 bg-slate-50 p-4" colSpan={7}>
                            <LogDetail
                              error={detailQuery.error}
                              isLoading={detailQuery.isLoading}
                              onRetry={() => void detailQuery.refetch()}
                              prompt={detailQuery.data?.prompt_text}
                              response={detailQuery.data?.response_text}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function LogDetail({
  error,
  isLoading,
  onRetry,
  prompt,
  response,
}: {
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  prompt?: string;
  response?: string | null;
}) {
  if (isLoading) return <p className="text-sm text-slate-500">正在打开这次记录...</p>;
  if (error) return <InlineError error={error} onRetry={onRetry} />;
  return (
    <div className="grid gap-4">
      <h3 className="text-sm font-bold text-slate-950">这次怎么问、怎么答</h3>
      <LogText label="问模型的话" value={prompt ?? ''} />
      <LogText label="模型的回答" value={response ?? '无响应内容'} />
    </div>
  );
}

function LogText({ label, value }: { label: string; value: string }) {
  return (
    <section>
      <h4 className="mb-2 text-sm font-semibold text-slate-800">{label}</h4>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-white p-3 font-mono text-sm leading-6 text-slate-700">
        {value}
      </pre>
    </section>
  );
}

function InlineError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-red-700" role="alert">
      <span>{getUserErrorMessage(error)}</span>
      <Button onClick={onRetry} variant="danger">
        再试一次
      </Button>
    </div>
  );
}
