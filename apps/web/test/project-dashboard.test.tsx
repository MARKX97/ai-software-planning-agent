import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDashboard } from '../src/components/project/project-dashboard';
import { deleteProject, listProjects } from '../src/features/projects/api';

vi.mock('../src/features/projects/api', () => ({ deleteProject: vi.fn(), listProjects: vi.fn() }));

const project = {
  id: 'project-1',
  name: 'Planning Agent',
  original_idea: 'Turn ideas into plans',
  status: 'active',
  current_stage: 'init',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ProjectDashboard />
    </QueryClientProvider>,
  );
}

describe('ProjectDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listProjects).mockResolvedValue({ items: [project], total: 1, offset: 0, limit: 20 });
    vi.mocked(deleteProject).mockResolvedValue();
  });

  it('filters projects and resets pagination', async () => {
    renderDashboard();
    expect(await screen.findByRole('link', { name: 'Planning Agent' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: '已经收好' }));
    await waitFor(() =>
      expect(listProjects).toHaveBeenLastCalledWith({ limit: 20, offset: 0, status: 'completed' }),
    );
  });

  it('deletes only after user confirmation', async () => {
    const confirm = vi
      .spyOn(window, 'confirm')
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderDashboard();
    const remove = await screen.findByRole('button', { name: '移除' });
    await userEvent.click(remove);
    expect(deleteProject).not.toHaveBeenCalled();
    await userEvent.click(remove);
    await waitFor(() => expect(vi.mocked(deleteProject).mock.calls[0]?.[0]).toBe('project-1'));
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('shows an actionable empty state', async () => {
    vi.mocked(listProjects).mockResolvedValue({ items: [], total: 0, offset: 0, limit: 20 });
    renderDashboard();
    expect(await screen.findByRole('heading', { name: '这里还空着' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '放进第一个想法' })).toHaveAttribute(
      'href',
      '/projects/new',
    );
  });
});
