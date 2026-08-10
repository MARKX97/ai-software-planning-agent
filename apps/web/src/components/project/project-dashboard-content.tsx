import Link from 'next/link';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { ProjectStatus, StageName } from '@/components/project/project-status';
import { formatDateTime } from '@/lib/format';
import type { ProjectListResponse, ProjectResponse } from '@/types/api';
import { DashboardGuide } from './project-dashboard-guide';

const PAGE_SIZE = 20;
type ProjectFilter = 'active' | 'completed' | 'failed' | '';

interface ProjectDashboardContentProps {
  data?: ProjectListResponse;
  deleteError: Error | null;
  deletingId?: string;
  error: Error | null;
  isLoading: boolean;
  offset: number;
  onDelete: (projectId: string, name: string) => void;
  onOffsetChange: (offset: number) => void;
  onRetry: () => void;
  onRetryDelete?: () => void;
  onStatusChange: (status: ProjectFilter) => void;
  status: ProjectFilter;
}

export function ProjectDashboardContent(props: ProjectDashboardContentProps) {
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4">
        <ProjectFilters onChange={props.onStatusChange} status={props.status} />
        {props.isLoading ? <ListSkeleton rows={5} /> : null}
        {props.error ? <ErrorState error={props.error} onRetry={props.onRetry} /> : null}
        {props.deleteError ? (
          <ErrorState
            error={props.deleteError}
            onRetry={props.onRetryDelete}
            title="删除项目失败"
          />
        ) : null}
        <ProjectList {...props} />
      </div>
      <DashboardGuide />
    </section>
  );
}

function ProjectFilters({
  onChange,
  status,
}: {
  onChange: (status: ProjectFilter) => void;
  status: ProjectFilter;
}) {
  const filters: Array<{ label: string; value: ProjectFilter }> = [
    { label: '全部', value: '' },
    { label: '正在推进', value: 'active' },
    { label: '已经收好', value: 'completed' },
    { label: '需要回看', value: 'failed' },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="tablist" aria-label="项目状态筛选">
      {filters.map((item) => (
        <button
          aria-selected={status === item.value}
          className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition ${status === item.value ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'}`}
          key={item.value}
          onClick={() => onChange(item.value)}
          role="tab"
          type="button"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ProjectList(props: ProjectDashboardContentProps) {
  if (props.isLoading || props.error) return null;
  if (props.data?.items.length === 0)
    return (
      <EmptyState
        action={<ButtonLink href="/projects/new">放进第一个想法</ButtonLink>}
        description="不用先写成需求文档。说说你想为谁解决什么问题，剩下的可以边走边补。"
        title="这里还空着"
      />
    );
  if (!props.data?.items.length) return null;
  return (
    <>
      <div className="grid gap-3">
        {props.data.items.map((project) => (
          <ProjectCard
            deleting={props.deletingId === project.id}
            key={project.id}
            onDelete={props.onDelete}
            project={project}
          />
        ))}
      </div>
      <Pagination data={props.data} offset={props.offset} onChange={props.onOffsetChange} />
    </>
  );
}

function ProjectCard({
  deleting,
  onDelete,
  project,
}: {
  deleting: boolean;
  onDelete: (projectId: string, name: string) => void;
  project: ProjectResponse;
}) {
  return (
    <Card className="transition hover:-translate-y-0.5 hover:shadow-md">
      <CardBody className="grid gap-4 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="text-lg font-bold text-slate-950 hover:underline"
              href={`/projects/${project.id}`}
            >
              {project.name}
            </Link>
            <ProjectStatus status={project.status} />
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
            {project.original_idea}
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-slate-500">
            <span>
              现在在做：
              <StageName stage={project.current_stage} />
            </span>
            <span>上次动过：{formatDateTime(project.updated_at)}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:justify-end">
          <ButtonLink href={`/projects/${project.id}`} variant="secondary">
            继续看看
          </ButtonLink>
          <Button
            disabled={deleting}
            onClick={() => onDelete(project.id, project.name)}
            variant="danger"
          >
            {deleting ? '正在移除' : '移除'}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Pagination({
  data,
  offset,
  onChange,
}: {
  data: ProjectListResponse;
  offset: number;
  onChange: (offset: number) => void;
}) {
  const pageEnd = Math.min(data.total, data.offset + data.limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-sm font-medium text-slate-600">
        正在看第 {data.offset + 1}-{pageEnd} 个，共 {data.total} 个项目
      </p>
      <div className="flex gap-2">
        <Button
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))}
          variant="secondary"
        >
          上一页
        </Button>
        <Button
          disabled={offset + PAGE_SIZE >= data.total}
          onClick={() => onChange(offset + PAGE_SIZE)}
          variant="secondary"
        >
          下一页
        </Button>
      </div>
    </div>
  );
}
