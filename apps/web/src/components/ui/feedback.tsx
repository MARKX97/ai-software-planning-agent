import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { getUserErrorMessage } from '@/lib/api-client';
import { ApiClientError } from '@/types/api';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="flex flex-col items-start gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        {action}
      </CardBody>
    </Card>
  );
}

export function ErrorState({
  title = '请求失败',
  error,
  onRetry,
}: {
  title?: string;
  error: Error;
  onRetry?: () => void;
}) {
  const code = error instanceof ApiClientError ? error.code : null;
  return (
    <Card className="border-red-200 bg-red-50">
      <CardBody className="flex flex-col gap-3">
        <div>
          <h2 className="text-base font-semibold text-red-800">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-700" role="alert">
            {getUserErrorMessage(error)}
          </p>
          {code ? <p className="mt-1 text-xs text-red-600">错误代码：{code}</p> : null}
        </div>
        {onRetry ? (
          <Button className="w-fit" onClick={onRetry} variant="danger">
            重试
          </Button>
        ) : null}
      </CardBody>
    </Card>
  );
}
