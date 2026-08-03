import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiDownload, apiRequest, getUserErrorMessage } from '../src/lib/api-client';
import { ApiClientError } from '../src/types/api';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
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
      message: '输入信息有误，请检查后重试。',
      status: 400,
      details: { field: 'name' },
    } satisfies Partial<ApiClientError>);
  });

  it('turns network failures into an actionable error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(apiRequest('/projects')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      message: '无法连接到服务，请检查网络或确认服务已启动后重试。',
      status: 0,
    } satisfies Partial<ApiClientError>);
  });

  it('does not expose internal server messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: 'INTERNAL_ERROR', message: 'database password leaked' },
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    await expect(apiRequest('/projects')).rejects.toMatchObject({
      code: 'INTERNAL_ERROR',
      message: '服务暂时不可用，请稍后重试。',
    } satisfies Partial<ApiClientError>);
  });

  it('converts stored workflow failures for existing projects', () => {
    expect(getUserErrorMessage('fetch failed')).toBe(
      '无法连接到服务，请检查网络或确认服务已启动后重试。',
    );
  });

  it('builds query, auth and JSON body while omitting empty query values', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_KEY', 'test-key');
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await apiRequest('/projects', {
      method: 'POST',
      query: { offset: 0, status: '', missing: undefined },
      body: { name: 'Project' },
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toContain('/projects?offset=0');
    expect(String(url)).not.toContain('status=');
    expect(init).toMatchObject({
      method: 'POST',
      headers: { Authorization: 'Bearer test-key', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Project' }),
    });
  });

  it('handles empty success and malformed JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await expect(apiRequest('/projects/project-1', { method: 'DELETE' })).resolves.toBeUndefined();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('not-json', { status: 200 })),
    );
    await expect(apiRequest('/projects')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('sends multipart bodies without overriding the browser boundary', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: 'source-1' })));
    vi.stubGlobal('fetch', fetchMock);
    const body = new FormData();
    body.append('file', new File(['# Context'], 'context.md', { type: 'text/markdown' }));
    await apiRequest('/knowledge', { method: 'POST', body });
    const init = fetchMock.mock.calls[0]?.[1];
    expect(init?.body).toBe(body);
    expect(init?.headers).not.toHaveProperty('Content-Type');
  });

  it('downloads successful responses and maps failed downloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('file', { status: 200 })),
    );
    const blob = await apiDownload('/artifact');
    expect(await blob.text()).toBe('file');
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ error: { code: 'ARTIFACT_NOT_FOUND' } }), { status: 404 }),
      ),
    );
    await expect(apiDownload('/artifact')).rejects.toMatchObject({ code: 'ARTIFACT_NOT_FOUND' });
  });
});
