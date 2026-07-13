import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiEventStream } from '@/lib/sse-client';
import { ApiClientError } from '@/types/api';

afterEach(() => vi.unstubAllGlobals());

describe('apiEventStream', () => {
  it('parses fragmented delta and done events', async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'event: delta\ndata: {"content":"你',
      '好"}\n\nevent: done\ndata: {"ok":true}\n\n',
    ];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
                controller.close();
              },
            }),
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );
    const deltas: string[] = [];
    const result = await apiEventStream<{ ok: boolean }>('/stream', {
      method: 'POST',
      body: {},
      onDelta: (content) => deltas.push(content),
    });
    expect(deltas).toEqual(['你好']);
    expect(result).toEqual({ ok: true });
  });

  it('maps an SSE error event to ApiClientError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            'event: error\ndata: {"error":{"code":"LLM_TIMEOUT","message":"超时"},"retryable":true}\n\n',
            { headers: { 'content-type': 'text/event-stream' } },
          ),
      ),
    );
    await expect(
      apiEventStream('/stream', { method: 'POST', onDelta: () => {} }),
    ).rejects.toMatchObject<ApiClientError>({
      code: 'LLM_TIMEOUT',
      message: '超时',
      retryable: true,
    });
  });
});
