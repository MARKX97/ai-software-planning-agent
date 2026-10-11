import type { WorkflowStateResponse } from '@/types/api';
import { MarkdownDocument } from '@/components/ui/markdown-document';
import { labels, values } from './stage-labels';

export function StageRecord({ state }: { state?: WorkflowStateResponse }) {
  if (!state) return <p className="text-sm text-slate-500">这一步还没开始。</p>;
  if (state.error_message) return <p className="text-sm text-red-700">{state.error_message}</p>;
  const rawData = Object.fromEntries(
    Object.entries(state.data_json ?? {}).filter(([key]) => key !== '_workflow'),
  );
  const data = presentationData(rawData);
  if (Object.keys(data).length === 0)
    return <p className="text-sm text-slate-500">这一步没有留下额外记录。</p>;
  if (isEmptyRequirementAnalysis(data)) {
    return (
      <p className="text-sm leading-6 text-slate-600">
        当时没有拿到可分析的需求资料，因此这份旧分析不能作为有效结论。重新运行后会基于完整需求生成中文分析。
      </p>
    );
  }
  return <RecordValue value={data} />;
}

function presentationData(data: Record<string, unknown>): Record<string, unknown> {
  const { content, ...rest } = data;
  if (typeof content !== 'string') return data;
  const parsed = parseJsonRecord(content);
  if (parsed) return { ...rest, ...parsed };
  if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
    return {
      ...rest,
      stage_summary:
        '这份历史结论没有完整生成，暂时无法可靠整理。请重新运行当前阶段，以获得完整的中文结论。',
    };
  }
  return content.trim() ? { ...rest, stage_summary: content } : rest;
}

function parseJsonRecord(value: string): Record<string, unknown> | null {
  const text = value
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function isEmptyRequirementAnalysis(data: Record<string, unknown>): boolean {
  const analyses = ['deepseek', 'glm', 'minimax']
    .map((provider) => data[provider])
    .filter((value): value is Record<string, unknown> =>
      Boolean(value && typeof value === 'object' && !Array.isArray(value)),
    );
  return (
    analyses.length === 3 &&
    analyses.every((analysis) => {
      const points = analysis['requirement_points'];
      return Array.isArray(points) && points.length === 0;
    })
  );
}

function RecordValue({ value }: { value: unknown }) {
  if (value === null || value === undefined || value === '') {
    return <span className="text-slate-500">暂无</span>;
  }
  if (typeof value === 'boolean') return <span>{value ? '是' : '否'}</span>;
  if (typeof value === 'string' && value.includes('\n'))
    return <MarkdownDocument content={value} />;
  if (typeof value !== 'object')
    return <span className="whitespace-pre-wrap">{values[String(value)] ?? String(value)}</span>;
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-slate-500">暂无</span>;
    return (
      <ul className="grid gap-2">
        {value.map((item, index) => (
          <li className="rounded-md bg-white px-3 py-2" key={index}>
            <RecordValue value={item} />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <dl className="grid gap-3">
      {Object.entries(value).map(([key, item]) => (
        <div className="grid gap-1" key={key}>
          <dt className="text-xs font-bold text-slate-500">{labels[key] ?? key}</dt>
          <dd className="text-sm leading-6 text-slate-700">
            <RecordValue value={item} />
          </dd>
        </div>
      ))}
    </dl>
  );
}
