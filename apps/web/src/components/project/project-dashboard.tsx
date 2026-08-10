'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ButtonLink } from '@/components/ui/button';
import { PageFrame } from '@/components/layout/app-shell';
import { deleteProject, listProjects } from '@/features/projects/api';
import { ProjectDashboardContent } from './project-dashboard-content';

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
  function handleDelete(projectId: string, name: string) {
    if (window.confirm(`确认删除项目「${name}」？此操作会从列表隐藏该项目。`)) {
      deleteMutation.mutate(projectId);
    }
  }

  return (
    <PageFrame
      actions={<ButtonLink href="/projects/new">放进一个想法</ButtonLink>}
      description="把还没想清楚的点子放在这里。我们会陪你把它问明白、算明白，最后留下团队真能接着做的计划。"
      eyebrow="你的项目"
      title="把想法做成计划"
    >
      <ProjectDashboardContent
        data={projectsQuery.data}
        deleteError={deleteMutation.error}
        deletingId={deleteMutation.isPending ? deleteMutation.variables : undefined}
        error={projectsQuery.error}
        isLoading={projectsQuery.isLoading}
        offset={offset}
        onDelete={handleDelete}
        onOffsetChange={setOffset}
        onRetry={() => void projectsQuery.refetch()}
        onRetryDelete={
          deleteMutation.variables
            ? () => deleteMutation.mutate(deleteMutation.variables)
            : undefined
        }
        onStatusChange={(value) => {
          setStatus(value);
          setOffset(0);
        }}
        status={status}
      />
    </PageFrame>
  );
}
