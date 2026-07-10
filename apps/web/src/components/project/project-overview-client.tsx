'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge, statusVariant } from '@/components/ui/badge';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/layout/app-shell';
import { StageName } from '@/components/project/project-status';
import { getProject } from '@/features/projects/api';
import { getWorkflowStatus, runWorkflow } from '@/features/workflow/api';
import { formatDateTime } from '@/lib/format';

export function ProjectOverviewClient({ projectId }: { projectId: string }) {
  const router = useRouter();
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });
  const workflowQuery = useQuery({
    queryKey: ['workflow-status', projectId],
    queryFn: () => getWorkflowStatus(projectId),
  });
  const runMutation = useMutation({
    mutationFn: () => runWorkflow(projectId),
    onSuccess: () => {
      router.push(`/projects/${projectId}/workflow`);
    },
  });
  const project = projectQuery.data;
  const workflow = workflowQuery.data;

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}/workflow`} variant="secondary">
            查看工作流
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
            查看产物
          </ButtonLink>
        </>
      }
      description="查看项目当前阶段、启动规划流水线，并进入产物与用量页面。"
      eyebrow="Project Overview"
      title={project?.name ?? '项目详情'}
    >
      {projectQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {projectQuery.error ? (
        <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />
      ) : null}
      {runMutation.error ? (
        <ErrorState
          error={runMutation.error}
          onRetry={() => runMutation.mutate()}
          title="启动工作流失败"
        />
      ) : null}
      {workflowQuery.error ? (
        <ErrorState
          error={workflowQuery.error}
          onRetry={() => void workflowQuery.refetch()}
          title="工作流状态加载失败"
        />
      ) : null}
      {project ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">项目输入</h2>
                  <Badge variant={statusVariant(project.status)}>{project.status}</Badge>
                </div>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {project.original_idea}
                </p>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-bold text-slate-950">下一步操作</h2>
              </CardHeader>
              <CardBody className="flex flex-col gap-3 sm:flex-row">
                {project.current_stage === 'init' ? (
                  <Button disabled={runMutation.isPending} onClick={() => runMutation.mutate()}>
                    {runMutation.isPending ? '启动中' : '启动工作流'}
                  </Button>
                ) : (
                  <ButtonLink href={`/projects/${projectId}/workflow`}>继续查看工作流</ButtonLink>
                )}
                {project.status === 'completed' ? (
                  <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
                    阅读生成产物
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/projects/${projectId}/usage`} variant="quiet">
                  查看模型用量
                </ButtonLink>
              </CardBody>
            </Card>
          </div>

          <aside className="grid h-fit gap-4">
            <Card className="border-cyan-200 bg-cyan-50">
              <CardBody>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-900">
                  Current Stage
                </p>
                <h2 className="mt-2 text-2xl font-black text-cyan-950">
                  <StageName stage={project.current_stage} />
                </h2>
                <p className="mt-2 text-sm text-cyan-900">
                  更新于 {formatDateTime(project.updated_at)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">工作流进度</span>
                  <span className="font-bold text-slate-950">
                    {workflow?.progress.percentage ?? 0}%
                  </span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-slate-200">
                  <div
                    className="h-2 rounded-full bg-slate-950 transition-all"
                    style={{ width: `${workflow?.progress.percentage ?? 0}%` }}
                  />
                </div>
              </CardBody>
            </Card>
          </aside>
        </div>
      ) : null}
    </PageFrame>
  );
}
