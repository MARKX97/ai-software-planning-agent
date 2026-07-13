import { ApiClientError } from '@/types/api';
import { apiFetch, parseApiError, type RequestOptions } from '@/lib/api-client';

interface StreamRequestOptions extends RequestOptions {
  readonly onDelta: (content: string) => void;
  readonly signal?: AbortSignal;
}

interface ErrorEventData {
  error?: { code?: string; message?: string; details?: Record<string, unknown> };
  retryable?: boolean;
}

export async function apiEventStream<T>(path: string, options: StreamRequestOptions): Promise<T> {
  const response = await apiFetch(path, {
    method: options.method,
    query: options.query,
    body: options.body,
    signal: options.signal,
  });
  if (!response.ok) throw await parseApiError(response);
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new ApiClientError('服务返回了无法识别的数据，请稍后重试。', 'INVALID_RESPONSE', 0);
  }
  return consumeEvents(response.body, options);
}

async function consumeEvents<T>(
  body: ReadableStream<Uint8Array>,
  options: Pick<StreamRequestOptions, 'onDelta' | 'signal'>,
): Promise<T> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    if (options.signal?.aborted) {
      await reader.cancel();
      throw new DOMException('Request aborted', 'AbortError');
    }
    const next = await reader.read();
    buffer += decoder.decode(next.value, { stream: !next.done });
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const result = parseEvent<T>(frame, options.onDelta);
      if (result.done) return result.value;
    }
    if (next.done) break;
  }
  throw new ApiClientError('回复意外中断，请重试。', 'INVALID_RESPONSE', 0);
}

function parseEvent<T>(
  frame: string,
  onDelta: (content: string) => void,
): { done: false } | { done: true; value: T } {
  if (!frame || frame.startsWith(':')) return { done: false };
  const lines = frame.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith('event:'))
    ?.slice(6)
    .trim();
  const data = lines
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n');
  if (!event || !data) return { done: false };
  const parsed = parseJson(data);
  if (event === 'delta') {
    const content = (parsed as { content?: unknown }).content;
    if (typeof content === 'string') onDelta(content);
    return { done: false };
  }
  if (event === 'error') throw streamError(parsed as ErrorEventData);
  return event === 'done' ? { done: true, value: parsed as T } : { done: false };
}

function parseJson(data: string): unknown {
  try {
    return JSON.parse(data);
  } catch {
    throw new ApiClientError('服务返回了无法识别的数据，请稍后重试。', 'INVALID_RESPONSE', 0);
  }
}

function streamError(data: ErrorEventData): ApiClientError {
  const code = data.error?.code ?? 'API_ERROR';
  return new ApiClientError(
    data.error?.message ?? '回复生成失败，请稍后重试。',
    code,
    200,
    data.error?.details,
    data.retryable,
  );
}
