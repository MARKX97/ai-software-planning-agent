'use client';

import { useQuery } from '@tanstack/react-query';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ErrorState } from '@/components/ui/feedback';
import { ListSkeleton } from '@/components/ui/skeleton';
import { PageFrame } from '@/components/layout/app-shell';
import { ProjectStatus, StageName } from '@/components/project/project-status';
import { getProject } from '@/features/projects/api';
import { getWorkflowStatus } from '@/features/workflow/api';
import { formatDateTime } from '@/lib/format';

export function ProjectOverviewClient({ projectId }: { projectId: string }) {
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => getProject(projectId),
  });
  const workflowQuery = useQuery({
    queryKey: ['workflow-status', projectId],
    queryFn: () => getWorkflowStatus(projectId),
  });
  const project = projectQuery.data;
  const workflow = workflowQuery.data;

  return (
    <PageFrame
      actions={
        <>
          <ButtonLink href={`/projects/${projectId}/workflow`} variant="secondary">
            看看进展
          </ButtonLink>
          <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
            看看整理好的内容
          </ButtonLink>
        </>
      }
      description="先回到最初那个想法。准备好后，我们会从最关键的问题开始，一步步把它变成可开工的计划。"
      eyebrow="这个想法"
      title={project?.name ?? '正在打开项目'}
    >
      {projectQuery.isLoading ? <ListSkeleton rows={3} /> : null}
      {projectQuery.error ? (
        <ErrorState error={projectQuery.error} onRetry={() => void projectQuery.refetch()} />
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
                  <h2 className="text-lg font-bold text-slate-950">你当时是这样说的</h2>
                  <ProjectStatus status={project.status} />
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
                <h2 className="text-lg font-bold text-slate-950">接下来怎么走</h2>
              </CardHeader>
              <CardBody className="flex flex-col gap-3 sm:flex-row">
                {project.current_stage === 'init' ? (
                  <ButtonLink href={`/projects/${projectId}/workflow?start=1`}>
                    开始把它想清楚
                  </ButtonLink>
                ) : (
                  <ButtonLink href={`/projects/${projectId}/workflow`}>继续看看</ButtonLink>
                )}
                {project.status === 'completed' ? (
                  <ButtonLink href={`/projects/${projectId}/artifacts`} variant="secondary">
                    看看整理好的内容
                  </ButtonLink>
                ) : null}
                <ButtonLink href={`/projects/${projectId}/usage`} variant="quiet">
                  看看这次花了多少
                </ButtonLink>
              </CardBody>
            </Card>
          </div>

          <aside className="grid h-fit gap-4">
            <Card className="border-cyan-200 bg-cyan-50">
              <CardBody>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-900">
                  现在走到这
                </p>
                <h2 className="mt-2 text-2xl font-black text-cyan-950">
                  <StageName stage={project.current_stage} />
                </h2>
                <p className="mt-2 text-sm text-cyan-900">
                  最后动过：{formatDateTime(project.updated_at)}
                </p>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-700">已经走过</span>
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
