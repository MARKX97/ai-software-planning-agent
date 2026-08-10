import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { ARTIFACT_TYPE_LABELS, type ArtifactType } from '@/features/artifacts/api';
import type { WorkflowStatusResponse } from '@/types/api';

export function GraphRecoveryPanel({ status }: { status: WorkflowStatusResponse }) {
  if (!status.graph_run) return null;
  const run = status.graph_run;
  return (
    <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
      <p>
        执行节点：{run.current_node} · 恢复版本 {run.checkpoint_version}
        {run.recovery_available ? ' · 可恢复' : ''}
        {run.interrupt_reason
          ? ` · 等待 ${run.interrupt_reason === 'reply' ? '回复' : '确认'}`
          : ''}
      </p>
      {run.retrieval_summary ? <p className="mt-1">取证摘要：{run.retrieval_summary}</p> : null}
      {run.tool_steps.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-slate-800">查看取证轨迹</summary>
          <ol className="mt-2 space-y-2">
            {run.tool_steps.map((step) => (
              <li className="rounded bg-slate-50 px-2 py-1" key={step.id}>
                {step.stage} · {step.tool} · {toolStatusLabel(step.status)}
                {step.summary ? ` · ${step.summary}` : ''}
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  );
}

export function RegenerationPanel({
  busy,
  onRegenerate,
  status,
}: {
  busy: boolean;
  onRegenerate: () => void;
  status: WorkflowStatusResponse;
}) {
  if (!status.regeneration) return null;
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardBody className="grid gap-3">
        <h2 className="text-sm font-bold text-amber-950">项目证据有变化</h2>
        <p className="text-sm leading-6 text-amber-900">
          将只更新：{status.regeneration.affected_artifacts.map(artifactLabel).join('、')}。
        </p>
        <Button className="w-fit" disabled={busy} onClick={onRegenerate}>
          {busy ? '正在更新' : '更新受影响产物'}
        </Button>
      </CardBody>
    </Card>
  );
}

function artifactLabel(value: string): string {
  return ARTIFACT_TYPE_LABELS[value as ArtifactType] ?? value;
}

function toolStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    running: '执行中',
    success: '成功',
    failed: '失败',
    rejected: '已拒绝',
  };
  return labels[status] ?? status;
}
