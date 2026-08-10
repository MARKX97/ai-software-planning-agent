import { Fragment } from 'react';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { stageName, statusName } from '@/components/project/project-status';
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
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
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
        {['参与者', '在做什么', '结果', '用量', '花费', '时间', '细节'].map((label) => (
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
        <td className="py-3 pr-4 text-slate-700">{stageName(log.stage)}</td>
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
            {selected ? '收起' : '看看细节'}
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
      <span className="font-semibold">{log.provider_name}</span>
      <span className="ml-2 text-xs text-slate-500">第 {log.attempt_number} 次</span>
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
  return (
    <div className="grid gap-4">
      <h3 className="text-sm font-bold text-slate-950">这次怎么问、怎么答</h3>
      <LogText label="问模型的话" value={props.detail?.prompt_text ?? ''} />
      <LogText label="模型的回答" value={props.detail?.response_text ?? '无响应内容'} />
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
