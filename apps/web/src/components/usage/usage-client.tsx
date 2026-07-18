'use client';

import { useQuery } from '@tanstack/react-query';
import { PageFrame } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { stageName } from '@/components/project/project-status';
import { UsageLogTable } from '@/components/usage/usage-log-table';
import { getTokenUsage } from '@/features/usage/api';
import { formatCurrency, formatNumber } from '@/lib/format';
import type { TokenUsageDetailResponse } from '@/types/api';

export function UsageClient({ projectId }: { projectId: string }) {
  const usageQuery = useQuery({
    queryKey: ['usage', projectId],
    queryFn: () => getTokenUsage(projectId),
  });
  const usage = usageQuery.data;

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}/workflow`} variant="secondary">
            看看进展
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
            看看整理好的内容
          </ButtonLink>
        </>
      }
      description="想知道这次梳理花了多少、哪些模型参与过，可以在这里看清楚。数字放在这里，是为了帮你心里有数。"
      eyebrow="这次花了多少"
      title="调用与成本"
    >
      {usageQuery.isLoading ? <ListSkeleton rows={2} /> : null}
      {usageQuery.error ? (
        <ErrorState error={usageQuery.error} onRetry={() => void usageQuery.refetch()} />
      ) : null}
      {usage ? (
        <>
          <BudgetNotice usage={usage} />
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {[
              { label: '总成本', value: formatCurrency(usage.total_cost) },
              { label: '总 Token', value: formatNumber(usage.total_tokens) },
              { label: '问过几次', value: formatNumber(usage.call_count) },
              {
                label: '成功率',
                value: usage.success_rate === null ? '暂无' : `${usage.success_rate}%`,
              },
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
                <h2 className="text-base font-bold text-slate-950">谁出了多少力</h2>
              </CardHeader>
              <CardBody className="grid gap-3">
                {usage.by_provider.length === 0 ? (
                  <p className="text-sm text-slate-600">还没有调用记录。</p>
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
                <h2 className="text-base font-bold text-slate-950">每一步花了多少</h2>
              </CardHeader>
              <CardBody className="grid gap-3">
                {usage.by_stage.length === 0 ? (
                  <p className="text-sm text-slate-600">还没有成本记录。</p>
                ) : (
                  usage.by_stage.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 text-sm"
                      key={item.stage}
                    >
                      <span className="font-medium text-slate-700">{stageName(item.stage)}</span>
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

      <UsageLogTable projectId={projectId} />
    </PageFrame>
  );
}

function BudgetNotice({ usage }: { usage: TokenUsageDetailResponse }) {
  if (usage.total_cost >= usage.cost_limit.max_cost_per_project) {
    return (
      <p
        className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        role="alert"
      >
        这次的模型预算已经用完，新的讨论和推进会先停下。这里是本地估算，最终账单以白山控制台为准。
      </p>
    );
  }
  if (!usage.cost_limit.alert_triggered) return null;
  return (
    <p
      className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900"
      role="status"
    >
      已经用了预算的 80%，剩下 {formatCurrency(usage.cost_limit.remaining)} 可以继续安排。
    </p>
  );
}
