import { Badge, statusVariant } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { stageName } from '@/components/project/project-status';
import { formatDateTime } from '@/lib/format';
import type { WorkflowStateResponse, WorkflowStatusResponse } from '@/types/api';

const stages = [
  'requirement_analysis',
  'requirement_clarification',
  'multi_model_analysis',
  'requirement_synthesis',
  'feasibility_analysis',
  'risk_analysis',
  'mvp_compression',
  'platform_recommendation',
  'planning_generation',
];

export function StageRail({
  status,
  states,
}: {
  status: WorkflowStatusResponse | null;
  states: WorkflowStateResponse[];
}) {
  const stateByStage = new Map(states.map((item) => [item.stage, item]));
  return (
    <Card>
      <CardBody>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-950">阶段轨道</h2>
            <p className="text-sm text-slate-600">
              当前：{status?.stage_display_name ?? '未启动'}，进度{' '}
              {status?.progress.percentage ?? 0}%
            </p>
          </div>
          <Badge variant={statusVariant(status?.status ?? 'init')}>
            {status?.status ?? 'init'}
          </Badge>
        </div>
        <ol className="grid gap-2">
          {stages.map((stage, index) => {
            const state = stateByStage.get(stage);
            const active = status?.current_stage === stage;
            return (
              <li
                className={`grid grid-cols-[32px_1fr] gap-3 rounded-md border p-3 ${
                  active ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'
                }`}
                key={stage}
              >
                <span
                  className={`grid size-8 place-items-center rounded-full text-xs font-bold ${
                    active ? 'bg-cyan-900 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {index + 1}
                </span>
                <span>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-950">{stageName(stage)}</span>
                    <Badge variant={statusVariant(state?.status ?? 'pending')}>
                      {state?.status ?? 'pending'}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">
                    {state ? formatDateTime(state.created_at) : '等待执行'}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
