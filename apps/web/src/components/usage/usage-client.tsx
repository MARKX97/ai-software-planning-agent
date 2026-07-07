'use client';

import { useState } from 'react';
import { PageFrame } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { listModelLogs, getTokenUsage } from '@/features/usage/api';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import { useAsync } from '@/lib/use-async';

const PAGE_SIZE = 20;

export function UsageClient({ projectId }: { projectId: string }) {
  const [offset, setOffset] = useState(0);
  const usageState = useAsync(() => getTokenUsage(projectId), [projectId]);
  const logsState = useAsync(() => listModelLogs(projectId, offset, PAGE_SIZE), [projectId, offset]);
  const usage = usageState.data;
  const logs = logsState.data;

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}/workflow`} variant="secondary">
            工作流
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
            产物
          </ButtonLink>
        </>
      }
      description="查看 Token、成本、成功率和模型调用日志。这里帮助用户判断产物背后的调用证据和预算风险。"
      eyebrow="Usage"
      title="模型用量"
    >
      {usageState.loading ? <ListSkeleton rows={2} /> : null}
      {usageState.error ? <ErrorState error={usageState.error} onRetry={usageState.reload} /> : null}
      {usage ? (
        <>
          {usage.cost_limit.alert_triggered ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900" role="status">
              成本已超过预算 80%，剩余额度 {formatCurrency(usage.cost_limit.remaining)}。
            </p>
          ) : null}
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: '总成本', value: formatCurrency(usage.total_cost) },
              { label: '总 Token', value: formatNumber(usage.total_tokens) },
              { label: '调用次数', value: formatNumber(usage.call_count) },
              { label: '成功率', value: usage.success_rate === null ? '暂无' : `${usage.success_rate}%` },
            ].map((item) => (
              <Card key={item.label}>
                <CardBody>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-slate-950">{item.value}</p>
                </CardBody>
              </Card>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <h2 className="text-base font-bold text-slate-950">Provider 分布</h2>
              </CardHeader>
              <CardBody className="grid gap-3">
                {usage.by_provider.length === 0 ? (
                  <p className="text-sm text-slate-600">暂无调用记录。</p>
                ) : (
                  usage.by_provider.map((item) => (
                    <div className="grid gap-1" key={item.provider_name}>
                      <div className="flex justify-between gap-3 text-sm">
                        <span className="font-semibold text-slate-800">{item.provider_name}</span>
                        <span className="text-slate-600">{formatCurrency(item.total_cost)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200">
                        <div
                          className="h-2 rounded-full bg-cyan-700"
                          style={{
                            width: `${usage.total_cost > 0 ? Math.max(4, (item.total_cost / usage.total_cost) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h2 className="text-base font-bold text-slate-950">阶段成本</h2>
              </CardHeader>
              <CardBody className="grid gap-3">
                {usage.by_stage.length === 0 ? (
                  <p className="text-sm text-slate-600">暂无阶段成本。</p>
                ) : (
                  usage.by_stage.map((item) => (
                    <div className="flex items-center justify-between gap-3 text-sm" key={item.stage}>
                      <span className="font-medium text-slate-700">{item.stage}</span>
                      <span className="font-semibold text-slate-950">
                        {formatCurrency(item.total_cost)}
                      </span>
                    </div>
                  ))
                )}
              </CardBody>
            </Card>
          </section>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-bold text-slate-950">模型调用日志</h2>
            <div className="flex gap-2">
              <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} variant="secondary">
                上一页
              </Button>
              <Button
                disabled={!logs || offset + PAGE_SIZE >= logs.total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                variant="secondary"
              >
                下一页
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {logsState.loading ? <ListSkeleton rows={4} /> : null}
          {logsState.error ? <ErrorState error={logsState.error} onRetry={logsState.reload} /> : null}
          {!logsState.loading && !logsState.error && logs?.items.length === 0 ? (
            <p className="text-sm text-slate-600">暂无模型调用日志。</p>
          ) : null}
          {logs?.items.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-[0.14em] text-slate-500">
                    <th className="py-3 pr-4">Provider</th>
                    <th className="py-3 pr-4">Stage</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4">Tokens</th>
                    <th className="py-3 pr-4">Cost</th>
                    <th className="py-3 pr-4">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.items.map((log) => (
                    <tr className="border-b border-slate-100" key={log.id}>
                      <td className="py-3 pr-4 font-semibold text-slate-900">{log.provider_name}</td>
                      <td className="py-3 pr-4 text-slate-700">{log.stage}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-700">
                        {formatNumber(log.input_tokens + log.output_tokens)}
                      </td>
                      <td className="py-3 pr-4 font-mono text-slate-700">
                        {formatCurrency(log.cost_total)}
                      </td>
                      <td className="py-3 pr-4 text-slate-600">{formatDateTime(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </CardBody>
      </Card>
    </PageFrame>
  );
}
