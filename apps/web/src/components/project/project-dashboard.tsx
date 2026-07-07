'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/layout/app-shell';
import { ProjectStatus, StageName } from '@/components/project/project-status';
import { formatDateTime } from '@/lib/format';
import { useAsync } from '@/lib/use-async';
import { deleteProject, listProjects } from '@/features/projects/api';

const PAGE_SIZE = 20;

export function ProjectDashboard() {
  const [status, setStatus] = useState<'active' | 'completed' | 'failed' | ''>('');
  const { data, error, loading, reload } = useAsync(
    () => listProjects({ limit: PAGE_SIZE, status }),
    [status],
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(projectId: string, name: string) {
    const confirmed = window.confirm(`确认删除项目「${name}」？此操作会从列表隐藏该项目。`);
    if (!confirmed) {
      return;
    }
    setDeletingId(projectId);
    try {
      await deleteProject(projectId);
      await reload();
    } finally {
      setDeletingId(null);
    }
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
                onClick={() => setStatus(item.value as typeof status)}
                role="tab"
                type="button"
              >
                {item.label}
              </button>
            ))}
          </div>

          {loading ? <ListSkeleton rows={5} /> : null}
          {error ? <ErrorState error={error} onRetry={reload} /> : null}
          {!loading && !error && data?.items.length === 0 ? (
            <EmptyState
              action={<ButtonLink href="/projects/new">创建第一个项目</ButtonLink>}
              description="输入一个产品想法，Agent 会按阶段收敛需求并生成工程产物。"
              title="还没有项目"
            />
          ) : null}

          {!loading && !error && data?.items.length ? (
            <div className="grid gap-3">
              {data.items.map((project) => (
                <Card className="transition hover:-translate-y-0.5 hover:shadow-md" key={project.id}>
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
                          当前阶段：<StageName stage={project.current_stage} />
                        </span>
                        <span>更新：{formatDateTime(project.updated_at)}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 md:justify-end">
                      <ButtonLink href={`/projects/${project.id}`} variant="secondary">
                        打开
                      </ButtonLink>
                      <Button
                        disabled={deletingId === project.id}
                        onClick={() => void handleDelete(project.id, project.name)}
                        variant="danger"
                      >
                        {deletingId === project.id ? '删除中' : '删除'}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
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
