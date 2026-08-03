import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeClient } from '@/components/knowledge/knowledge-client';
import {
  deleteKnowledgeSource,
  importKnowledgeRepository,
  listKnowledgeSources,
  reindexKnowledgeSource,
  uploadKnowledgeSource,
} from '@/features/knowledge/api';

vi.mock('@/features/knowledge/api', () => ({
  deleteKnowledgeSource: vi.fn(),
  importKnowledgeRepository: vi.fn(),
  listKnowledgeSources: vi.fn(),
  reindexKnowledgeSource: vi.fn(),
  uploadKnowledgeSource: vi.fn(),
}));

const source = {
  id: 'source-1',
  project_id: 'project-1',
  kind: 'file' as const,
  name: 'context.md',
  content_hash: 'a'.repeat(64),
  status: 'ready_with_warnings' as const,
  warning_count: 1,
  active_revision: 1,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function renderClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <KnowledgeClient projectId="project-1" />
    </QueryClientProvider>,
  );
}

describe('KnowledgeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listKnowledgeSources).mockResolvedValue({ items: [source], total: 1 });
    vi.mocked(uploadKnowledgeSource).mockResolvedValue(source);
    vi.mocked(importKnowledgeRepository).mockResolvedValue(source);
    vi.mocked(reindexKnowledgeSource).mockResolvedValue(source);
    vi.mocked(deleteKnowledgeSource).mockResolvedValue();
  });

  it('uploads, reindexes and deletes only after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderClient();
    expect(await screen.findByText('可用，但有提醒')).toBeInTheDocument();
    const file = new File(['# Context'], 'context.md', { type: 'text/markdown' });
    await userEvent.upload(screen.getByLabelText('Markdown、TXT 或 PDF 文件'), file);
    await userEvent.click(screen.getByRole('button', { name: '上传并索引' }));
    await waitFor(() => expect(uploadKnowledgeSource).toHaveBeenCalledWith('project-1', file));
    await userEvent.type(
      screen.getByLabelText('公开 GitHub 仓库'),
      'https://github.com/acme/sample',
    );
    await userEvent.click(screen.getByRole('button', { name: '导入仓库' }));
    await waitFor(() =>
      expect(importKnowledgeRepository).toHaveBeenCalledWith(
        'project-1',
        'https://github.com/acme/sample',
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: '重新索引' }));
    await waitFor(() =>
      expect(reindexKnowledgeSource).toHaveBeenCalledWith('project-1', 'source-1'),
    );
    await userEvent.click(screen.getByRole('button', { name: '删除' }));
    await waitFor(() =>
      expect(deleteKnowledgeSource).toHaveBeenCalledWith('project-1', 'source-1'),
    );
  });
});
