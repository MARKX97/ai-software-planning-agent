import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { formatDateTime } from '@/lib/format';
import type { KnowledgeSourceResponse, KnowledgeStatus } from '@/types/api';

const statusLabels: Record<KnowledgeStatus, string> = {
  pending: '等待索引',
  processing: '正在索引',
  ready: '可用于规划',
  ready_with_warnings: '可用，但有提醒',
  failed: '索引失败',
  deleted: '已删除',
};

const statusVariants: Record<KnowledgeStatus, BadgeVariant> = {
  pending: 'active',
  processing: 'active',
  ready: 'success',
  ready_with_warnings: 'warning',
  failed: 'danger',
  deleted: 'neutral',
};

export function KnowledgeSourceCard({
  source,
  busy,
  onReindex,
  onDelete,
}: {
  source: KnowledgeSourceResponse;
  busy: boolean;
  onReindex: () => void;
  onDelete: () => void;
}) {
  const canReindex = source.status === 'failed' || source.status === 'ready_with_warnings';
  const message = sourceMessage(source);

  return (
    <Card>
      <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="break-all text-base font-bold text-slate-950">{source.name}</h2>
            <Badge variant={statusVariants[source.status]}>{statusLabels[source.status]}</Badge>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            {source.active_revision ? `当前版本 ${source.active_revision} · ` : ''}
            更新于 {formatDateTime(source.updated_at)}
          </p>
          {message ? (
            <p className="mt-2 text-sm text-amber-800" role="status">
              {message}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {canReindex ? (
            <Button disabled={busy} onClick={onReindex} variant="secondary">
              {busy ? '正在处理' : '重新索引'}
            </Button>
          ) : null}
          <Button
            disabled={busy || source.status === 'processing'}
            onClick={onDelete}
            variant="danger"
          >
            删除
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function sourceMessage(source: KnowledgeSourceResponse): string | null {
  return (
    source.error_message ??
    (source.warning_count > 0 ? `索引完成，但有 ${source.warning_count} 项提醒。` : null)
  );
}
