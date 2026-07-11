'use client';

import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/layout/app-shell';
import { ProjectStatus, StageName } from '@/components/project/project-status';
import { formatDateTime } from '@/lib/format';
import { deleteProject, listProjects } from '@/features/projects/api';

const PAGE_SIZE = 20;

export function ProjectDashboard() {
  const [status, setStatus] = useState<'active' | 'completed' | 'failed' | ''>('');
  const [offset, setOffset] = useState(0);
  const queryClient = useQueryClient();
  const projectsQuery = useQuery({
    queryKey: ['projects', { limit: PAGE_SIZE, offset, status }],
    queryFn: () => listProjects({ limit: PAGE_SIZE, offset, status }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteProject,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
  const data = projectsQuery.data;
  const pageEnd = data ? Math.min(data.total, data.offset + data.limit) : 0;

  function handleDelete(projectId: string, name: string) {
    const confirmed = window.confirm(`确认删除项目「${name}」？此操作会从列表隐藏该项目。`);
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(projectId);
  }

  return (
    <PageFrame
      actions={<ButtonLink href="/projects/new">放进一个想法</ButtonLink>}
      description="把还没想清楚的点子放在这里。我们会陪你把它问明白、算明白，最后留下团队真能接着做的计划。"
      eyebrow="你的项目"
      title="把想法做成计划"
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="项目状态筛选">
            {[
              { label: '全部', value: '' },
              { label: '正在推进', value: 'active' },
              { label: '已经收好', value: 'completed' },
              { label: '需要回看', value: 'failed' },
            ].map((item) => (
              <button
                aria-selected={status === item.value}
                className={`min-h-11 rounded-md border px-4 text-sm font-semibold transition ${
                  status === item.value
                    ? 'border-slate-950 bg-slate-950 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                }`}
                key={item.value}
                onClick={() => {
                  setStatus(item.value as typeof status);
                  setOffset(0);
                }}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          {projectsQuery.isLoading ? <ListSkeleton rows={5} /> : null}
          {projectsQuery.error ? (
            <ErrorState error={projectsQuery.error} onRetry={() => void projectsQuery.refetch()} />
          ) : null}
          {deleteMutation.error ? (
            <ErrorState
              error={deleteMutation.error}
              onRetry={
                deleteMutation.variables
                  ? () => deleteMutation.mutate(deleteMutation.variables)
                  : undefined
              }
              title="删除项目失败"
            />
          ) : null}
          {!projectsQuery.isLoading && !projectsQuery.error && data?.items.length === 0 ? (
            <EmptyState
              action={<ButtonLink href="/projects/new">放进第一个想法</ButtonLink>}
              description="不用先写成需求文档。说说你想为谁解决什么问题，剩下的可以边走边补。"
              title="这里还空着"
            />
          ) : null}

          {!projectsQuery.isLoading && !projectsQuery.error && data?.items.length ? (
            <>
              <div className="grid gap-3">
                {data.items.map((project) => (
                  <Card
                    className="transition hover:-translate-y-0.5 hover:shadow-md"
                    key={project.id}
                  >
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
                          disabled={
                            deleteMutation.isPending && deleteMutation.variables === project.id
                          }
                          onClick={() => void handleDelete(project.id, project.name)}
                          variant="danger"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === project.id
                            ? '正在移除'
                            : '移除'}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-slate-600">
                  正在看第 {data.offset + 1}-{pageEnd} 个，共 {data.total} 个项目
                </p>
                <div className="flex gap-2">
                  <Button
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                    variant="secondary"
                  >
                    上一页
                  </Button>
                  <Button
                    disabled={offset + PAGE_SIZE >= data.total}
                    onClick={() => setOffset(offset + PAGE_SIZE)}
                    variant="secondary"
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <aside className="grid h-fit gap-3">
          <Card className="border-slate-950 bg-slate-950 text-white">
            <CardBody>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">
                从这里开始
              </p>
              <h2 className="mt-2 text-xl font-black">先把事情想明白</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                我们会先听你说，再把关键问题问清楚；能做什么、先做什么、有哪些坑，都会整理成一份能继续往下走的计划。
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="text-sm font-bold text-slate-950">先说人话就好</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                项目不必从一份完整的需求文档开始。告诉我们谁遇到了什么麻烦，剩下的细节可以在路上慢慢补齐。
              </p>
            </CardBody>
          </Card>
        </aside>
      </section>
    </PageFrame>
  );
}
