import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OpenAICompatibleAdapter } from '../src/adapters/openai-compatible.adapter.js';
import { LLMCancelledError, LLMNetworkError, LLMTimeoutError } from '../src/errors/llm-errors.js';

const request = { model: 'm', messages: [{ role: 'user' as const, content: 'hi' }] };
const runReal = process.env['RUN_REAL_BAISHAN_STREAM'] === '1';

describe('OpenAICompatibleAdapter.stream', () => {
  it('parses fragmented SSE deltas and final usage', async () => {
    const encoder = new TextEncoder();
    const parts = [
      'data: {"choices":[{"delta":{"content":"你',
      '好"}}]}\r\n\r\ndata: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":3,',
      '"completion_tokens":2}}\n\ndata: [DONE]\n\n',
    ];
    let requestBody: Record<string, unknown> | null = null;
    const fetch = async (_url: unknown, init?: RequestInit) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        new ReadableStream({
          start(controller) {
            for (const part of parts) controller.enqueue(encoder.encode(part));
            controller.close();
          },
        }),
        { status: 200 },
      );
    };
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof globalThis.fetch,
    );
    const deltas: string[] = [];
    const result = await adapter.stream(request, 1000, {
      onDelta: (content) => deltas.push(content),
    });
    assert.deepEqual(deltas, ['你好']);
    assert.equal(result.content, '你好');
    assert.deepEqual(result.usage, { inputTokens: 3, outputTokens: 2 });
    assert.equal(requestBody?.['stream'], true);
    assert.deepEqual(requestBody?.['stream_options'], { include_usage: true });
  });

  it('rejects malformed SSE data', async () => {
    const fetch = async () => new Response('data: nope\n\n', { status: 200 });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof globalThis.fetch,
    );
    await assert.rejects(
      () => adapter.stream(request, 1000, { onDelta: () => {} }),
      LLMNetworkError,
    );
  });

  it('requires final usage before DONE', async () => {
    const fetch = async () =>
      new Response('data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
      });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof globalThis.fetch,
    );
    await assert.rejects(
      () => adapter.stream(request, 1000, { onDelta: () => {} }),
      /missing token usage/,
    );
  });

  it('maps stream timeout and caller cancellation separately', async () => {
    const pendingFetch = async (_url: unknown, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        );
      });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      pendingFetch as unknown as typeof globalThis.fetch,
    );
    await assert.rejects(() => adapter.stream(request, 1, { onDelta: () => {} }), LLMTimeoutError);

    const controller = new AbortController();
    const cancelled = adapter.stream(request, 1000, {
      onDelta: () => {},
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(() => cancelled, LLMCancelledError);
  });

  it('maps stream gateway failures before parsing the body', async () => {
    const fetch = async () => new Response('{}', { status: 503 });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof globalThis.fetch,
    );
    await assert.rejects(
      () => adapter.stream(request, 1000, { onDelta: () => {} }),
      LLMNetworkError,
    );
  });

  it('receives a real Baishan delta, DONE and final usage', { skip: !runReal }, async () => {
    const adapter = new OpenAICompatibleAdapter(
      'baishan',
      process.env['BAISHAN_BASE_URL'] ?? '',
      process.env['BAISHAN_API_KEY'] ?? '',
    );
    const deltas: string[] = [];
    const result = await adapter.stream(
      {
        model: process.env['BAISHAN_MODEL_GLM'] ?? 'glm-5.1',
        messages: [{ role: 'user', content: '只回复“流式测试通过”。' }],
      },
      60_000,
      { onDelta: (content) => deltas.push(content) },
    );
    assert.ok(deltas.length > 0);
    assert.equal(deltas.join(''), result.content);
    assert.ok(result.usage.inputTokens > 0);
    assert.ok(result.usage.outputTokens > 0);
  });
});
