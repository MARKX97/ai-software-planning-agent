import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '../src/lib/api-client';
import { ApiClientError } from '../src/types/api';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses ApiError responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                code: 'INVALID_INPUT',
                message: 'Name is required',
                details: { field: 'name' },
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    await expect(apiRequest('/projects')).rejects.toMatchObject({
      code: 'INVALID_INPUT',
      message: 'Name is required',
      status: 400,
      details: { field: 'name' },
    } satisfies Partial<ApiClientError>);
  });
});
