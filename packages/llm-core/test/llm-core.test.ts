import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import {
  feasibilityAssessmentSchema,
  multiModelAnalysisSchema,
  mvpPlanSchema,
  platformRecommendationSchema,
  requirementAnalysisSchema,
  riskAnalysisSchema,
  synthesizedRequirementSchema,
} from '@ai-planning/shared';
import { calculateCost } from '../src/utils/calculate-cost.js';
import { validateSchema, parseStructuredOutput } from '../src/utils/parse-structured-output.js';
import { createRetryPolicy } from '../src/utils/create-retry-policy.js';
import {
  isRetryable,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMAuthError,
  LLMNetworkError,
} from '../src/errors/llm-errors.js';
import { OpenAICompatibleAdapter } from '../src/adapters/openai-compatible.adapter.js';
import { MockLLMProvider } from '../src/mock/mock-llm-provider.js';

describe('calculateCost', () => {
  it('computes cost from token usage and pricing', () => {
    const usage = { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 };
    const pricing = { inputPer1k: 0.002, outputPer1k: 0.008 };
    const cost = calculateCost(usage, pricing);
    assert.ok(Math.abs(cost.inputCost - 0.002) < 1e-6);
    assert.ok(Math.abs(cost.outputCost - 0.004) < 1e-6);
    assert.ok(Math.abs(cost.totalCost - 0.006) < 1e-6);
  });
});

describe('parseStructuredOutput', () => {
  it('parses plain JSON', () => {
    assert.deepEqual(parseStructuredOutput('{"a": 1}'), { a: 1 });
  });
  it('strips ```json fences', () => {
    assert.deepEqual(parseStructuredOutput('```json\n{"a": 1}\n```'), { a: 1 });
  });
  it('throws on non-JSON', () => {
    assert.throws(() => parseStructuredOutput('not json'));
  });
});

describe('validateSchema', () => {
  const schema = z.object({ a: z.number() });
  it('returns success with parsed data', () => {
    const result = validateSchema({ a: 1 }, schema);
    assert.equal(result.success, true);
    if (result.success) assert.deepEqual(result.data, { a: 1 });
  });
  it('returns failure with issues', () => {
    const result = validateSchema({ a: 'x' }, schema);
    assert.equal(result.success, false);
  });
});

describe('retry policy', () => {
  it('delays follow exponential backoff 1s -> 2s -> 4s', () => {
    const policy = createRetryPolicy();
    assert.equal(policy.delayForAttempt(1), 1000);
    assert.equal(policy.delayForAttempt(2), 2000);
    assert.equal(policy.delayForAttempt(3), 4000);
  });
});

describe('isRetryable', () => {
  it('retries timeouts and rate limits', () => {
    assert.equal(isRetryable(new LLMTimeoutError()), true);
    assert.equal(isRetryable(new LLMRateLimitError()), true);
  });
  it('does not retry auth errors', () => {
    assert.equal(isRetryable(new LLMAuthError()), false);
  });
});

describe('OpenAICompatibleAdapter', () => {
  it('maps 401 to LLMAuthError', async () => {
    const fetch = async () => new Response('{}', { status: 401 });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof fetch,
    );
    await assert.rejects(
      () => adapter.complete({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }, 1000),
      LLMAuthError,
    );
  });
  it('maps 429 to LLMRateLimitError', async () => {
    const fetch = async () => new Response('{}', { status: 429 });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof fetch,
    );
    await assert.rejects(
      () => adapter.complete({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }, 1000),
      LLMRateLimitError,
    );
  });
  it('rejects malformed success responses', async () => {
    const fetch = async () => new Response('{}', { status: 200 });
    const adapter = new OpenAICompatibleAdapter(
      'test',
      'https://x',
      'k',
      fetch as unknown as typeof fetch,
    );
    await assert.rejects(
      () => adapter.complete({ model: 'm', messages: [{ role: 'user', content: 'hi' }] }, 1000),
      LLMNetworkError,
    );
  });
});

describe('MockLLMProvider', () => {
  it('returns a response with parsed content', async () => {
    const provider = new MockLLMProvider('deepseek');
    const res = await provider.chat('hello');
    assert.equal(res.provider, 'deepseek');
    assert.notEqual(res.structuredOutput, null);
  });
  it('validates against provided schema', async () => {
    const schema = z.object({ mock: z.boolean() });
    const provider = new MockLLMProvider('glm');
    const res = await provider.chat('hi', { outputSchema: schema });
    // zod strips unknown keys by default → only `mock` survives.
    assert.deepEqual(res.structuredOutput, { mock: true });
  });
  it('asks once for clarification, then continues after a reply', async () => {
    const schema = z.object({
      needs_more_clarification: z.boolean(),
      clarification_questions: z.array(z.object({ question: z.string() })),
    });
    const provider = new MockLLMProvider('glm');
    const first = await provider.chat('needs_more_clarification\nConversation history: (none)', {
      outputSchema: schema,
    });
    const continued = await provider.chat('needs_more_clarification\nConversation history: reply', {
      outputSchema: schema,
    });
    assert.deepEqual(first.structuredOutput, {
      needs_more_clarification: true,
      clarification_questions: [
        { question: '首版主要想服务哪个城市？' },
        { question: '用户做选择时，最看重省时间、控制预算，还是吃得健康？' },
      ],
    });
    assert.deepEqual(continued.structuredOutput, {
      needs_more_clarification: false,
      clarification_questions: [],
    });
  });
  it('returns schema-valid content for every demo stage', async () => {
    const provider = new MockLLMProvider('deepseek');
    const cases = [
      ['RequirementAnalysisResult schema', requirementAnalysisSchema],
      ['MultiModelAnalysisResult schema', multiModelAnalysisSchema],
      ['SynthesizedRequirement schema', synthesizedRequirementSchema],
      ['FeasibilityAssessment schema', feasibilityAssessmentSchema],
      ['RiskAnalysisResult schema', riskAnalysisSchema],
      ['MVPPlan schema', mvpPlanSchema],
      ['PlatformRecommendation schema', platformRecommendationSchema],
    ] as const;
    for (const [prompt, outputSchema] of cases) {
      const response = await provider.chat(prompt, { outputSchema });
      assert.notEqual(response.structuredOutput, null, prompt);
    }
  });
  it('returns readable Markdown for demo artifacts', async () => {
    const provider = new MockLLMProvider('deepseek');
    const response = await provider.chat('Artifact type to generate:\nprd');
    assert.match(response.content, /^# 今晚吃什么 PRD/);
  });
});
