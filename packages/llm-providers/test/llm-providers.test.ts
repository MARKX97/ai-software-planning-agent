import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import type { LLMRequest, LLMStreamOptions } from '@ai-planning/shared';
import type { ILLMHttpClient } from '@ai-planning/llm-core';
import { OpenAICompatibleAdapter } from '@ai-planning/llm-core';
import { ProviderRegistry, DeepSeekProvider, GLMProvider, MiniMaxProvider } from '../src/index.js';
import { createProviderConfigs } from '../src/config/provider-config.factory.js';

/** Stub HTTP client that returns canned content. */
class StubClient implements ILLMHttpClient {
  readonly name = 'stub';
  readonly requests: LLMRequest[] = [];
  constructor(private readonly content: string) {}

  async complete(request: LLMRequest): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  }> {
    this.requests.push(request);
    return { content: this.content, usage: { inputTokens: 5, outputTokens: 7, cachedTokens: 0 } };
  }

  async stream(
    _request: unknown,
    _timeoutMs: number,
    options: Pick<LLMStreamOptions, 'onDelta'>,
  ): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number; cachedTokens: number };
  }> {
    await options.onDelta(this.content);
    return this.complete();
  }
}

describe('createProviderConfigs', () => {
  it('builds three configs from model ids', () => {
    const configs = createProviderConfigs.build({
      modelIds: { deepseek: 'DeepSeek-V4-Flash-0731', glm: 'GLM-5.2', minimax: 'MiniMax-M3' },
    });
    assert.equal(configs.length, 3);
    assert.equal(configs[0].name, 'deepseek');
    assert.equal(configs[0].pricing.inputPer1k, 0.003);
  });
});

describe('BaseProvider chat flow', () => {
  it('returns parsed JSON when no schema', async () => {
    const stub = new StubClient('{"answer": 42}');
    const provider = new DeepSeekProvider('DeepSeek-V4-Flash-0731', stub);
    const res = await provider.chat('hi');
    assert.equal(res.provider, 'deepseek');
    assert.equal(res.model, 'DeepSeek-V4-Flash-0731');
    assert.equal(res.usage.totalTokens, 12);
    assert.deepEqual(res.structuredOutput, { answer: 42 });
  });

  it('gives DeepSeek enough output budget for its reasoning before the answer', async () => {
    const stub = new StubClient('{"answer": 42}');
    await new DeepSeekProvider('DeepSeek-V4-Flash-0731', stub).chat('hi');
    assert.equal(stub.requests[0]?.maxTokens, 8192);
  });

  it('validates structured output against schema', async () => {
    const stub = new StubClient('{"answer": 42}');
    const provider = new GLMProvider('GLM-5.2', stub);
    const res = await provider.chat('hi', { outputSchema: z.object({ answer: z.number() }) });
    assert.deepEqual(res.structuredOutput, { answer: 42 });
  });

  it('degrades to null on schema failure', async () => {
    const stub = new StubClient('{"answer": "not a number"}');
    const provider = new MiniMaxProvider('MiniMax-M3', stub);
    const res = await provider.chat('hi', { outputSchema: z.object({ answer: z.number() }) });
    assert.equal(res.structuredOutput, null);
  });

  it('degrades to null on non-JSON content', async () => {
    const stub = new StubClient('not json at all');
    const provider = new DeepSeekProvider('DeepSeek-V4-Flash-0731', stub);
    const res = await provider.chat('hi');
    assert.equal(res.structuredOutput, null);
  });

  it('streams deltas and returns the normalized response with cost', async () => {
    const provider = new GLMProvider('GLM-5.2', new StubClient('实时回复'));
    const deltas: string[] = [];
    const res = await provider.chatStream('hi', {
      onDelta: (content) => deltas.push(content),
    });
    assert.equal(deltas.join(''), res.content);
    assert.equal(res.usage.totalTokens, 12);
    assert.ok(res.cost.totalCost > 0);
  });
});

describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    const provider = new DeepSeekProvider('DeepSeek-V4-Flash-0731', new StubClient('{}'));
    registry.register(provider);
    assert.equal(registry.has('deepseek'), true);
    assert.equal(registry.get('deepseek'), provider);
    assert.equal(registry.list().length, 1);
  });

  it('throws on unknown provider', () => {
    const registry = new ProviderRegistry();
    assert.throws(() => registry.get('nope'));
  });

  it('healthCheckAll returns all providers', async () => {
    const registry = new ProviderRegistry();
    registry.register(new DeepSeekProvider('DeepSeek-V4-Flash-0731', new StubClient('{}')));
    const health = await registry.healthCheckAll();
    assert.equal(Object.keys(health).length, 1);
    assert.equal(health['deepseek'], true);
  });
});

describe('OpenAICompatibleAdapter integration', () => {
  it('returns parsed content on 200', async () => {
    const body = JSON.stringify({
      choices: [{ message: { content: '{"ok": true}' } }],
      usage: { prompt_tokens: 3, completion_tokens: 4 },
    });
    const fetch = async () => new Response(body, { status: 200 });
    const adapter = new OpenAICompatibleAdapter({
      name: 'test',
      baseUrl: 'https://x',
      apiKey: 'k',
      fetchImpl: fetch as unknown as typeof globalThis.fetch,
    });
    const provider = new DeepSeekProvider('DeepSeek-V4-Flash-0731', adapter);
    const res = await provider.chat('hi', { outputSchema: z.object({ ok: z.boolean() }) });
    assert.deepEqual(res.structuredOutput, { ok: true });
  });
});
