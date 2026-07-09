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

  async function handleDelete(projectId: string, name: string) {
    const confirmed = window.confirm(`确认删除项目「${name}」？此操作会从列表隐藏该项目。`);
    if (!confirmed) {
      return;
    }
    await deleteMutation.mutateAsync(projectId);
  }

  return (
    <PageFrame
      actions={<ButtonLink href="/projects/new">新建项目</ButtonLink>}
      description="把一个粗糙的软件想法推进成需求、风险、MVP、架构与工程规则。这里是所有规划任务的入口。"
      eyebrow="Phase 10 / Frontend"
      title="规划控制台"
    >
      <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="项目状态筛选">
            {[
              { label: '全部', value: '' },
              { label: '进行中', value: 'active' },
              { label: '已完成', value: 'completed' },
              { label: '失败', value: 'failed' },
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
          {!projectsQuery.isLoading && !projectsQuery.error && data?.items.length === 0 ? (
            <EmptyState
              action={<ButtonLink href="/projects/new">创建第一个项目</ButtonLink>}
              description="输入一个产品想法，Agent 会按阶段收敛需求并生成工程产物。"
              title="还没有项目"
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
                            当前阶段：
                            <StageName stage={project.current_stage} />
                          </span>
                          <span>更新：{formatDateTime(project.updated_at)}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        <ButtonLink href={`/projects/${project.id}`} variant="secondary">
                          打开
                        </ButtonLink>
                        <Button
                          disabled={
                            deleteMutation.isPending && deleteMutation.variables === project.id
                          }
                          onClick={() => void handleDelete(project.id, project.name)}
                          variant="danger"
                        >
                          {deleteMutation.isPending && deleteMutation.variables === project.id
                            ? '删除中'
                            : '删除'}
                        </Button>
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-sm font-medium text-slate-600">
                  显示 {data.offset + 1}-{pageEnd} / 共 {data.total} 个项目
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
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-200">Workflow</p>
              <h2 className="mt-2 text-xl font-black">九阶段规划轨道</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                需求分析、澄清、多模型分析、综合、风险、MVP、平台推荐和最终产物生成会串成一条可追踪的证据链。
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <h2 className="text-sm font-bold text-slate-950">前端设计取向</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                这个界面不是营销页，而是规划工作台：密度更高，信息层级清楚，状态可扫描，关键操作可恢复。
              </p>
            </CardBody>
          </Card>
        </aside>
      </section>
    </PageFrame>
  );
}
