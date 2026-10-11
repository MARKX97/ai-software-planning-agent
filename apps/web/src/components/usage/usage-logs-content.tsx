import { Fragment } from 'react';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { stageDescription, stageName, statusName } from '@/components/project/project-status';
import { getUserErrorMessage } from '@/lib/api-client';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';
import type {
  ModelExecutionLogDetailResponse,
  ModelExecutionLogListResponse,
  ModelExecutionLogResponse,
} from '@/types/api';

interface UsageLogsContentProps {
  detail?: ModelExecutionLogDetailResponse;
  detailError: Error | null;
  detailLoading: boolean;
  error: Error | null;
  isLoading: boolean;
  logs?: ModelExecutionLogListResponse;
  onRetryDetail: () => void;
  onRetryLogs: () => void;
  onSelect: (id: string | null) => void;
  selectedLogId: string | null;
}

export function UsageLogsContent(props: UsageLogsContentProps) {
  if (props.isLoading) return <p className="text-sm text-slate-500">正在读取调用记录...</p>;
  if (props.error) return <InlineError error={props.error} onRetry={props.onRetryLogs} />;
  if (props.logs?.items.length === 0)
    return <p className="text-sm text-slate-600">这里还没有记录。</p>;
  if (!props.logs?.items.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <LogTableHeader />
        <tbody>
          {props.logs.items.map((log) => (
            <LogRows key={log.id} log={log} props={props} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogTableHeader() {
  return (
    <thead>
      <tr className="border-b border-slate-200 text-xs text-slate-500">
        {['模型', '本次工作', '结果', '用量', '花费', '时间', '审计'].map((label) => (
          <th className="py-3 pr-4" key={label}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function LogRows({ log, props }: { log: ModelExecutionLogResponse; props: UsageLogsContentProps }) {
  const selected = props.selectedLogId === log.id;
  return (
    <Fragment>
      <tr className={selected ? 'bg-cyan-50' : 'border-b border-slate-100'}>
        <td className="py-3 pr-4 text-slate-900">
          <ProviderAttempt log={log} />
        </td>
        <td className="max-w-72 py-3 pr-4 text-slate-700">
          <p className="font-medium text-slate-800">{stageName(log.stage)}</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">{callDescription(log)}</p>
        </td>
        <td className="py-3 pr-4">
          <Badge variant={statusVariant(log.status)}>{statusName(log.status)}</Badge>
        </td>
        <td className="py-3 pr-4 font-mono text-slate-700">
          {formatNumber(log.input_tokens + log.output_tokens)}
        </td>
        <td className="py-3 pr-4 font-mono text-slate-700">{formatCurrency(log.cost_total)}</td>
        <td className="py-3 pr-4 text-slate-600">{formatDateTime(log.created_at)}</td>
        <td className="py-3 pr-4">
          <Button
            aria-expanded={selected}
            onClick={() => props.onSelect(selected ? null : log.id)}
            variant="quiet"
          >
            {selected ? '收起' : '查看调用审计'}
          </Button>
        </td>
      </tr>
      {selected ? (
        <tr>
          <td className="border-b border-slate-200 bg-slate-50 p-4" colSpan={7}>
            <LogDetail props={props} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function ProviderAttempt({ log }: { log: ModelExecutionLogResponse }) {
  return (
    <>
      <span className="font-semibold">{log.model_id}</span>
      <span className="ml-2 text-xs text-slate-500">
        {log.provider_name} · 第 {log.attempt_number} 次
      </span>
      {log.attempt_number > 1 && log.status === 'success' ? (
        <Badge className="ml-2" variant="active">
          接手
        </Badge>
      ) : null}
    </>
  );
}

function LogDetail({ props }: { props: UsageLogsContentProps }) {
  if (props.detailLoading) return <p className="text-sm text-slate-500">正在打开这次记录...</p>;
  if (props.detailError)
    return <InlineError error={props.detailError} onRetry={props.onRetryDetail} />;
  const detail = props.detail;
  return (
    <div className="grid gap-4">
      <div>
        <h3 className="text-sm font-bold text-slate-950">调用审计</h3>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          用于核对本次调用的成本、耗时和处理状态。
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <AuditMetric label="使用模型" value={detail?.model_id ?? '未记录'} />
        <AuditMetric label="耗时" value={formatLatency(detail?.latency_ms)} />
        <AuditMetric
          label="Token 用量"
          value={`输入 ${formatNumber(detail?.input_tokens ?? 0)} · 输出 ${formatNumber(detail?.output_tokens ?? 0)}`}
        />
        <AuditMetric label="缓存命中" value={`${formatNumber(detail?.cached_tokens ?? 0)} Token`} />
        <AuditMetric label="预估花费" value={formatCurrency(detail?.cost_total ?? 0)} />
        <AuditMetric label="调用阶段" value={stageName(detail?.stage ?? '')} />
        <AuditMetric label="本次工作" value={detail ? callDescription(detail) : '未记录'} />
      </dl>
      {detail?.error_code ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-800">
          {detail.error_code}：{detail.error_message ?? '本次调用未完成。'}
        </p>
      ) : (
        <p className="text-sm leading-6 text-slate-700">模型调用成功，响应内容已按隐私策略省略。</p>
      )}
      <details className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">调试标识</summary>
        <dl className="mt-3 grid gap-3 text-sm">
          <AuditMetric label="提示词版本记录" value={detail?.prompt_version_id ?? '未记录'} />
          <AuditMetric label="Prompt SHA-256" value={detail?.prompt_hash ?? ''} mono />
        </dl>
      </details>
      <p className="text-xs text-slate-500">为保护个人资料和项目资料，不保存调用原文。</p>
    </div>
  );
}

function AuditMetric({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500">{label}</dt>
      <dd className={`mt-1 break-all text-sm text-slate-800 ${mono ? 'font-mono' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function formatLatency(value: number | null | undefined): string {
  if (value === null || value === undefined) return '未记录';
  if (value < 1_000) return `${value} 毫秒`;
  return `${Math.round((value / 1_000) * 10) / 10} 秒`;
}

function callDescription(
  log: Pick<ModelExecutionLogResponse, 'stage' | 'response_summary'>,
): string {
  const summary = log.response_summary?.trim();
  return summary && summary !== '模型调用成功，响应内容已按隐私策略省略。'
    ? summary
    : stageDescription(log.stage);
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
