import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ArtifactDetailClient } from '@/components/artifact/artifact-detail-client';
import { downloadArtifact, getArtifact } from '@/features/artifacts/api';

vi.mock('@/features/artifacts/api', () => ({ downloadArtifact: vi.fn(), getArtifact: vi.fn() }));

describe('ArtifactDetailClient', () => {
  beforeEach(() => {
    vi.mocked(getArtifact).mockResolvedValue({
      id: 'artifact-1',
      project_id: 'project-1',
      type: 'prd',
      type_display_name: 'PRD',
      title: 'PRD',
      stage: 'planning_generation',
      content: '# PRD [S1]',
      file_path: null,
      size_bytes: 12,
      format: 'markdown',
      created_at: '2026-01-01T00:00:00.000Z',
      citations: [
        {
          sourceId: 'source-1',
          documentId: 'document-1',
          chunkId: 'chunk-1',
          citationKey: 'S1',
          title: 'context.md',
          locator: 'context.md:L1-L3',
          excerpt: '首版必须支持证据引用。',
          contentHash: 'a'.repeat(64),
        },
      ],
    });
    vi.mocked(downloadArtifact).mockResolvedValue(new Blob());
  });

  it('opens the persisted citation snapshot', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ArtifactDetailClient artifactId="artifact-1" projectId="project-1" />
      </QueryClientProvider>,
    );
    const citation = await screen.findByText('[S1] context.md');
    await userEvent.click(citation);
    expect(screen.getByText('context.md:L1-L3')).toBeVisible();
    expect(screen.getByText('首版必须支持证据引用。')).toBeVisible();
    expect(screen.getByText('生成时保存的证据快照')).toBeVisible();
  });
});
