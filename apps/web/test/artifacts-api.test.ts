import { afterEach, describe, expect, it, vi } from 'vitest';
import { listArtifacts } from '../src/features/artifacts/api';

describe('listArtifacts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes artifact type as a query filter', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ items: [], total: 0 })));
    vi.stubGlobal('fetch', fetchMock);

    await listArtifacts('project-1', 'prd');

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('/projects/project-1/artifacts');
    expect(url).toContain('type=prd');
  });
});
