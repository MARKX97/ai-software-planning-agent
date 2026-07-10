import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, getUserErrorMessage } from '../src/lib/api-client';
import { ApiClientError } from '../src/types/api';

describe('apiRequest', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
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
});
