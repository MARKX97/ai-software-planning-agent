import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';

interface ActionPanelProps {
  readonly actionError: string | null;
  readonly busy: boolean;
  readonly failureMessage: string | null;
  readonly onStart: () => void;
  readonly showStart: boolean;
}

export function WorkflowActionPanels(props: ActionPanelProps) {
  const { actionError, busy, failureMessage, onStart, showStart } = props;
  return (
    <>
      {actionError && !failureMessage ? (
        <p
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {showStart ? <StartPanel busy={busy} onStart={onStart} /> : null}
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

function StartPanel({ busy, onStart }: { busy: boolean; onStart: () => void }) {
  return (
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
  );
}
