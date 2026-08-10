import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ARTIFACT_TYPES, ARTIFACT_TYPE_LABELS } from '@/features/artifacts/api';
import { formatBytes, formatDateTime } from '@/lib/format';
import type { ArtifactListResponse, ArtifactResponse } from '@/types/api';

interface ArtifactListContentProps {
  data?: ArtifactListResponse;
  error: Error | null;
  isLoading: boolean;
  onRetry: () => void;
  onTypeChange: (type: string) => void;
  projectId: string;
  type: string;
}

export function ArtifactListContent(props: ArtifactListContentProps) {
  return (
    <>
      <ArtifactTypeFilter onChange={props.onTypeChange} type={props.type} />
      {props.isLoading ? <ListSkeleton rows={6} /> : null}
      {props.error ? <ErrorState error={props.error} onRetry={props.onRetry} /> : null}
      <ArtifactItems {...props} />
    </>
  );
}

function ArtifactTypeFilter({
  onChange,
  type,
}: {
  onChange: (type: string) => void;
  type: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <TypeButton active={type === ''} label="全部" onClick={() => onChange('')} />
      {ARTIFACT_TYPES.map((artifactType) => (
        <TypeButton
          active={type === artifactType}
          key={artifactType}
          label={ARTIFACT_TYPE_LABELS[artifactType]}
          onClick={() => onChange(artifactType)}
        />
      ))}
    </div>
  );
}

function TypeButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'}`}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function ArtifactItems(props: ArtifactListContentProps) {
  if (props.isLoading || props.error) return null;
  if (props.data?.items.length === 0)
    return (
      <EmptyState
        action={<ButtonLink href={`/projects/${props.projectId}/workflow`}>回到进展页</ButtonLink>}
        description="等这次梳理走到最后，需求、风险、MVP 和可以交给团队的计划都会放在这里。"
        title="还在整理中"
      />
    );
  if (!props.data?.items.length) return null;
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {props.data.items.map((artifact) => (
        <ArtifactCard artifact={artifact} key={artifact.id} projectId={props.projectId} />
      ))}
    </div>
  );
}

function ArtifactCard({ artifact, projectId }: { artifact: ArtifactResponse; projectId: string }) {
  return (
    <Link href={`/projects/${projectId}/artifacts/${artifact.id}`}>
      <Card className="h-full transition hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md">
        <CardBody className="flex h-full flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-base font-bold leading-6 text-slate-950">{artifact.title}</h2>
            <Badge>{artifact.format}</Badge>
          </div>
          <p className="text-sm text-slate-600">{artifact.type_display_name}</p>
          <div className="mt-auto flex flex-wrap gap-3 text-xs font-medium text-slate-500">
            <span>{formatBytes(artifact.size_bytes)}</span>
            <span>{formatDateTime(artifact.created_at)}</span>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}
