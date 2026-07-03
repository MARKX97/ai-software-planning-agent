import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import type { ILLMHttpClient } from '@ai-planning/llm-core';
import { OpenAICompatibleAdapter } from '@ai-planning/llm-core';
import { ProviderRegistry, DeepSeekProvider, GLMProvider, MiniMaxProvider } from '../src/index.js';
import { createProviderConfigs } from '../src/config/provider-config.factory.js';

/** Stub HTTP client that returns canned content. */
class StubClient implements ILLMHttpClient {
  readonly name = 'stub';
  constructor(private readonly content: string) {}

  async complete(): Promise<{
    content: string;
    usage: { inputTokens: number; outputTokens: number };
  }> {
    return { content: this.content, usage: { inputTokens: 5, outputTokens: 7 } };
  }
}

describe('createProviderConfigs', () => {
  it('builds three configs from model ids', () => {
    const configs = createProviderConfigs.build({
      modelIds: { deepseek: 'deepseek-v4-pro', glm: 'glm-5.1', minimax: 'minimax-m2.5' },
    });
    assert.equal(configs.length, 3);
    assert.equal(configs[0].name, 'deepseek');
    assert.equal(configs[0].pricing.inputPer1k, 0.002);
  });
});

describe('BaseProvider chat flow', () => {
  it('returns parsed JSON when no schema', async () => {
    const stub = new StubClient('{"answer": 42}');
    const provider = new DeepSeekProvider('deepseek-v4-pro', stub);
    const res = await provider.chat('hi');
    assert.equal(res.provider, 'deepseek');
    assert.equal(res.model, 'deepseek-v4-pro');
    assert.equal(res.usage.totalTokens, 12);
    assert.deepEqual(res.structuredOutput, { answer: 42 });
  });

  it('validates structured output against schema', async () => {
    const stub = new StubClient('{"answer": 42}');
    const provider = new GLMProvider('glm-5.1', stub);
    const res = await provider.chat('hi', { outputSchema: z.object({ answer: z.number() }) });
    assert.deepEqual(res.structuredOutput, { answer: 42 });
  });

  it('degrades to null on schema failure', async () => {
    const stub = new StubClient('{"answer": "not a number"}');
    const provider = new MiniMaxProvider('minimax-m2.5', stub);
    const res = await provider.chat('hi', { outputSchema: z.object({ answer: z.number() }) });
    assert.equal(res.structuredOutput, null);
  });

  it('degrades to null on non-JSON content', async () => {
    const stub = new StubClient('not json at all');
    const provider = new DeepSeekProvider('deepseek-v4-pro', stub);
    const res = await provider.chat('hi');
    assert.equal(res.structuredOutput, null);
  });
});

describe('ProviderRegistry', () => {
  it('registers and retrieves providers', () => {
    const registry = new ProviderRegistry();
    const provider = new DeepSeekProvider('deepseek-v4-pro', new StubClient('{}'));
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
    registry.register(new DeepSeekProvider('deepseek-v4-pro', new StubClient('{}')));
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
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof fetch,
    );
    const provider = new DeepSeekProvider('deepseek-v4-pro', adapter);
    const res = await provider.chat('hi', { outputSchema: z.object({ ok: z.boolean() }) });
    assert.deepEqual(res.structuredOutput, { ok: true });
  });
});
