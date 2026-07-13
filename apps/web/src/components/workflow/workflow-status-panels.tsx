import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import type { WorkflowStatusResponse } from '@/types/api';

interface WorkflowStatusPanelsProps {
  actionError: string | null;
  busy: boolean;
  failureMessage: string | null;
  onStart: () => void;
  status: WorkflowStatusResponse;
}

export function WorkflowStatusPanels({
  actionError,
  busy,
  failureMessage,
  onStart,
  status,
}: WorkflowStatusPanelsProps) {
  const hasModelFailure =
    status.model_status && Object.values(status.model_status).some((value) => value === 'failed');

  return (
    <>
      <Card className="border-slate-950 bg-slate-950 text-white">
        <CardBody>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-200">正在进行</p>
          <div className="mt-3 flex items-end justify-between gap-3">
            <h2 className="text-3xl font-black">{status.progress.percentage}%</h2>
            <span className="text-sm text-slate-300">{status.stage_display_name}</span>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/15">
            <div
              className="h-2 rounded-full bg-cyan-300 transition-all"
              style={{ width: `${status.progress.percentage}%` }}
            />
          </div>
        </CardBody>
      </Card>

      {hasModelFailure ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardBody>
            <h2 className="text-sm font-bold text-amber-950">有个帮手没接上</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              有一个模型这次没有回应，不过其他结果还在继续。想看细节，可以到用量页里翻一翻。
            </p>
          </CardBody>
        </Card>
      ) : null}

      {status.current_stage === 'init' ? (
        <Card>
          <CardBody className="grid gap-3">
            <h2 className="text-base font-bold text-slate-950">还没开始</h2>
            <p className="text-sm leading-6 text-slate-600">
              点下开始后，我们会先把想法拆开看；遇到关键空白会问你，不会擅自替你补答案。
            </p>
            <Button disabled={busy} onClick={onStart}>
              {busy ? '正在开始' : '开始梳理'}
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {failureMessage ? (
        <Card className="border-red-200 bg-red-50">
          <CardBody className="grid gap-3">
            <h2 className="text-sm font-bold text-red-800">这次没走完</h2>
            <p className="text-sm leading-6 text-red-700" role="alert">
              {actionError ?? failureMessage}
            </p>
            <Button className="w-fit" disabled={busy} onClick={onStart} variant="danger">
              {busy ? '正在再试一次' : '再试一次'}
            </Button>
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
