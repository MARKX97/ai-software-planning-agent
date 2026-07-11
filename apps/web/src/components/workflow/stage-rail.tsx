import { Badge, statusVariant } from '@/components/ui/badge';
import { Card, CardBody } from '@/components/ui/card';
import { stageName, statusName } from '@/components/project/project-status';
import { StageRecord } from '@/components/workflow/stage-record';
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
            <h2 className="text-lg font-bold text-slate-950">这次走到哪了</h2>
            <p className="text-sm text-slate-600">
              现在在：{stageName(status?.current_stage ?? 'init')}，已经走过{' '}
              {status?.progress.percentage ?? 0}%
            </p>
          </div>
          <Badge variant={statusVariant(status?.status ?? 'init')}>
            {statusName(status?.status ?? 'init')}
          </Badge>
        </div>
        <ol className="grid gap-2">
          {stages.map((stage, index) => {
            const state = stateByStage.get(stage);
            const active = status?.current_stage === stage;
            return (
              <li key={stage}>
                <details
                  className={`group rounded-md border ${
                    active ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white'
                  }`}
                  open={active || undefined}
                >
                  <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[32px_1fr_auto] items-center gap-3 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 [&::-webkit-details-marker]:hidden">
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
                          {statusName(state?.status ?? 'pending')}
                        </Badge>
                      </span>
                      <span className="mt-1 block text-xs text-slate-500">
                        {state ? formatDateTime(state.created_at) : '还没轮到'}
                      </span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      <span className="group-open:hidden">展开</span>
                      <span className="hidden group-open:inline">收起</span>
                    </span>
                  </summary>
                  <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-4">
                    <StageRecord state={state} />
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}
