import type { LLMHttpClientResult } from '../interfaces/illm-http-client.js';
import { LLMNetworkError } from '../errors/llm-errors.js';

interface StreamChunk {
  choices?: Array<{ delta?: { content?: unknown } }>;
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
}

/** Parse an OpenAI-compatible SSE response and aggregate its final result. */
export async function parseOpenAiSse(
  response: Response,
  onDelta: (content: string) => void | Promise<void>,
): Promise<LLMHttpClientResult> {
  if (!response.body) throw new LLMNetworkError('Gateway stream has no response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let usage: LLMHttpClientResult['usage'] | null = null;
  let sawDone = false;
  while (!sawDone) {
    const next = await reader.read();
    buffer += decoder.decode(next.value, { stream: !next.done });
    const parsed = await consumeFrames(buffer, onDelta);
    buffer = parsed.remaining;
    content += parsed.content;
    usage = parsed.usage ?? usage;
    sawDone = parsed.done;
    if (next.done) break;
  }
  if (!sawDone) throw new LLMNetworkError('Gateway stream ended before [DONE]');
  if (!usage) throw new LLMNetworkError('Gateway stream missing token usage');
  return { content, usage };
}

async function consumeFrames(
  input: string,
  onDelta: (content: string) => void | Promise<void>,
): Promise<{
  remaining: string;
  content: string;
  usage: LLMHttpClientResult['usage'] | null;
  done: boolean;
}> {
  const frames = input.split(/\r?\n\r?\n/);
  const remaining = frames.pop() ?? '';
  let content = '';
  let usage: LLMHttpClientResult['usage'] | null = null;
  for (const frame of frames) {
    const data = frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n');
    if (!data) continue;
    if (data === '[DONE]') return { remaining, content, usage, done: true };
    const chunk = parseChunk(data);
    const delta = chunk.choices?.[0]?.delta?.content;
    if (typeof delta === 'string' && delta) {
      content += delta;
      await onDelta(delta);
    }
    usage = parseUsage(chunk) ?? usage;
  }
  return { remaining, content, usage, done: false };
}

function parseChunk(data: string): StreamChunk {
  try {
    return JSON.parse(data) as StreamChunk;
  } catch {
    throw new LLMNetworkError('Gateway returned invalid SSE data');
  }
}

function parseUsage(chunk: StreamChunk): LLMHttpClientResult['usage'] | null {
  if (!chunk.usage) return null;
  const inputTokens = Number(chunk.usage.prompt_tokens);
  const outputTokens = Number(chunk.usage.completion_tokens);
  if (!Number.isFinite(inputTokens) || !Number.isFinite(outputTokens)) {
    throw new LLMNetworkError('Gateway stream contains invalid token usage');
  }
  return { inputTokens, outputTokens };
}
