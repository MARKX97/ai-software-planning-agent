import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { LLMCallOptions, LLMResponse, LLMStreamOptions } from '@ai-planning/shared';
import { LLMTimeoutError, MockLLMProvider } from '@ai-planning/llm-core';
import type { ILLMProvider } from '@ai-planning/llm-core';
import { ProviderRegistry } from '@ai-planning/llm-providers';
import { LlmOrchestratorService } from '../src/llm-orchestrator.service.js';
import { createLlmOrchestrator } from '../src/factory.js';
import { AllModelsFailedError } from '../src/errors/all-models-failed.error.js';
import { CostController } from '../src/monitoring/cost-controller.js';

/** Provider that fails N times then succeeds, recording retries. */
class FlakyProvider implements ILLMProvider {
  name = 'flaky';
  modelId = 'flaky';
  pricing = { inputPer1k: 0.001, outputPer1k: 0.001 };
  attempts = 0;
  constructor(private readonly failTimes: number) {}

  async chat(prompt: string): Promise<LLMResponse> {
    this.attempts += 1;
    if (this.attempts <= this.failTimes) {
      throw new LLMTimeoutError(`simulated timeout ${this.attempts}`);
    }
    return {
      provider: this.name,
      model: this.modelId,
      content: prompt,
      structuredOutput: null,
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
      cost: { inputCost: 0.001, outputCost: 0.001, cachedInputCost: 0, totalCost: 0.002 },
      latencyMs: 10,
      retries: 0,
      timestamp: new Date().toISOString(),
    };
  }

  async chatStream(prompt: string, options: LLMStreamOptions): Promise<LLMResponse> {
    const response = await this.chat(prompt);
    await options.onDelta(response.content);
    return response;
  }
}

/** Always-fail provider used to exercise retry-exhaustion + fallback. */
class AlwaysFailProvider implements ILLMProvider {
  constructor(
    readonly name: string,
    readonly modelId = 'fail',
    readonly pricing = { inputPer1k: 0.001, outputPer1k: 0.001 },
  ) {}

  async chat(): Promise<LLMResponse> {
    throw new Error('always fails');
  }

  async chatStream(): Promise<LLMResponse> {
    return this.chat();
  }
}

class BrokenStreamProvider extends MockLLMProvider {
  attempts = 0;
  constructor(private readonly emitBeforeFailure: boolean) {
    super('glm');
  }

  override async chatStream(prompt: string, options: LLMStreamOptions): Promise<LLMResponse> {
    this.attempts += 1;
    if (this.attempts === 1) {
      if (this.emitBeforeFailure) await options.onDelta('partial');
      throw new LLMTimeoutError('stream failed');
    }
    return super.chatStream(prompt, options);
  }
}

function makeRegistry(...providers: ILLMProvider[]): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const p of providers) registry.register(p);
  return registry;
}

describe('callSingle', () => {
  it('returns a successful response', async () => {
    const svc = new LlmOrchestratorService(makeRegistry(new MockLLMProvider('glm')));
    const res = await svc.callSingle('glm', 'hello');
    assert.equal(res.provider, 'glm');
    assert.equal(res.retries, 0);
  });

  it('records calls in tracker', async () => {
    const svc = new LlmOrchestratorService(makeRegistry(new MockLLMProvider('glm')));
    await svc.callSingle('glm', 'hi');
    const stats = svc.getStats();
    assert.equal(stats.totalCalls, 1);
    assert.equal(stats.successCalls, 1);
  });

  it('records failed calls in tracker', async () => {
    const svc = new LlmOrchestratorService(makeRegistry(new AlwaysFailProvider('deepseek')));
    await assert.rejects(() => svc.callSingle('deepseek', 'hi'));
    const stats = svc.getStats();
    assert.equal(stats.totalCalls, 1);
    assert.equal(stats.failedCalls, 1);
    assert.equal(stats.byProvider['deepseek'].failed, 1);
  });
});

describe('callWithFallback', () => {
  it('returns the first successful provider', async () => {
    const svc = new LlmOrchestratorService(
      makeRegistry(new AlwaysFailProvider('deepseek'), new MockLLMProvider('glm')),
    );
    const res = await svc.callWithFallback(['deepseek', 'glm'], 'hello');
    assert.equal(res.provider, 'glm');
  });

  it('throws AllModelsFailedError when every provider fails', async () => {
    const svc = new LlmOrchestratorService(
      makeRegistry(new AlwaysFailProvider('deepseek'), new AlwaysFailProvider('glm')),
    );
    await assert.rejects(
      () => svc.callWithFallback(['deepseek', 'glm'], 'hello'),
      AllModelsFailedError,
    );
  });
});

describe('callSingleStreamWithFallback', () => {
  it('switches providers before output and reports the failed attempt', async () => {
    const svc = new LlmOrchestratorService(
      makeRegistry(new AlwaysFailProvider('glm', 'glm-model'), new MockLLMProvider('minimax')),
    );
    const failures: string[] = [];
    const response = await svc.callSingleStreamWithFallback(['glm', 'minimax'], 'hello', {
      onDelta: () => {},
      onProviderFailure: (attempt) => {
        failures.push(`${attempt.attemptNumber}:${attempt.provider}:${attempt.model}`);
      },
    });
    assert.equal(response.provider, 'minimax');
    assert.deepEqual(failures, ['1:glm:glm-model']);
  });

  it('does not switch providers after output has started', async () => {
    const broken = new BrokenStreamProvider(true);
    const fallback = new MockLLMProvider('minimax');
    const svc = new LlmOrchestratorService(makeRegistry(broken, fallback));
    await assert.rejects(
      () =>
        svc.callSingleStreamWithFallback(['glm', 'minimax'], 'hello', {
          onDelta: () => {},
        }),
      LLMTimeoutError,
    );
    assert.equal(broken.attempts, 1);
    assert.equal(svc.getStats().byProvider['minimax'], undefined);
  });

  it('throws when every stream provider fails', async () => {
    const svc = new LlmOrchestratorService(
      makeRegistry(new AlwaysFailProvider('glm'), new AlwaysFailProvider('minimax')),
    );
    await assert.rejects(
      () =>
        svc.callSingleStreamWithFallback(['glm', 'minimax'], 'hello', {
          onDelta: () => {},
        }),
      AllModelsFailedError,
    );
  });
});

describe('callMulti', () => {
  it('returns null entries for failed providers', async () => {
    const svc = new LlmOrchestratorService(
      makeRegistry(new AlwaysFailProvider('deepseek'), new MockLLMProvider('glm')),
    );
    const res = await svc.callMulti('hello');
    assert.equal(res['deepseek'], null);
    assert.notEqual(res['glm'], null);
  });

  it('throws AllModelsFailedError when all fail', async () => {
    const svc = new LlmOrchestratorService(
      makeRegistry(new AlwaysFailProvider('deepseek'), new AlwaysFailProvider('glm')),
    );
    await assert.rejects(() => svc.callMulti('hello'), AllModelsFailedError);
  });

  it('checks project budget before dispatching providers', async () => {
    const ctrl = new CostController(0.001);
    ctrl.track('p1', { inputCost: 0, outputCost: 0, cachedInputCost: 0, totalCost: 0.002 });
    const svc = new LlmOrchestratorService(makeRegistry(new MockLLMProvider('glm')), ctrl);
    await assert.rejects(() => svc.callMulti('hello', { projectId: 'p1' }));
  });
});

describe('CostController', () => {
  it('reports utilization and triggers alert at 80%', () => {
    const ctrl = new CostController(5.0, 0.8);
    const opts: LLMCallOptions = {};
    assert.equal(opts.projectId, undefined);
    // spend ¥4 → 80% threshold reached
    const cost = { inputCost: 2, outputCost: 2, cachedInputCost: 0, totalCost: 4 };
    ctrl.track('p1', cost);
    const stats = ctrl.getStats('p1');
    assert.equal(stats.totalCost, 4);
    assert.ok(stats.utilization >= 0.8);
    assert.equal(stats.alertTriggered, true);
  });

  it('detects over-budget', () => {
    const ctrl = new CostController(1.0);
    ctrl.track('p1', { inputCost: 0.5, outputCost: 0.5, cachedInputCost: 0, totalCost: 1.0 });
    assert.equal(ctrl.isOverBudget('p1'), true);
  });

  it('hydrates the latest persisted project total', () => {
    const ctrl = new CostController(5.0);
    ctrl.sync('p1', 4.5);
    assert.equal(ctrl.getStats('p1').totalCost, 4.5);
    assert.equal(ctrl.isOverBudget('p1'), false);
    ctrl.sync('p1', 5);
    assert.equal(ctrl.isOverBudget('p1'), true);
  });

  it('is wired through createLlmOrchestrator config', async () => {
    const svc = createLlmOrchestrator({
      baseUrl: '',
      apiKey: '',
      modelIds: { deepseek: 'd', glm: 'g', minimax: 'm' },
      costLimitPerProject: 0,
    });
    await assert.rejects(() => svc.callSingle('glm', 'hi', { projectId: 'p1' }));
  });
});

describe('createLlmOrchestrator factory', () => {
  it('registers mock providers when apiKey is empty', async () => {
    const svc = createLlmOrchestrator({
      baseUrl: '',
      apiKey: '',
      modelIds: { deepseek: 'd', glm: 'g', minimax: 'm' },
    });
    const health = await svc.healthCheck();
    assert.deepEqual(Object.keys(health).sort(), ['deepseek', 'glm', 'minimax']);
    assert.equal(Object.values(health).every(Boolean), true);
  });
});

describe('retry behavior', () => {
  it('retries retryable errors before succeeding', async () => {
    const provider = new FlakyProvider(1);
    const svc = new LlmOrchestratorService(makeRegistry(provider));
    const res = await svc.callSingle('flaky', 'hello');
    assert.equal(res.retries, 1);
    assert.equal(provider.attempts, 2);
  });

  it('retries a stream only before the first delta', async () => {
    const retryable = new BrokenStreamProvider(false);
    const svc = new LlmOrchestratorService(makeRegistry(retryable));
    const deltas: string[] = [];
    const response = await svc.callSingleStream('glm', 'hello', {
      onDelta: (content) => deltas.push(content),
    });
    assert.equal(retryable.attempts, 2);
    assert.equal(response.retries, 1);
    assert.ok(deltas.length > 0);

    const started = new BrokenStreamProvider(true);
    const noRetry = new LlmOrchestratorService(makeRegistry(started));
    await assert.rejects(
      () => noRetry.callSingleStream('glm', 'hello', { onDelta: () => {} }),
      LLMTimeoutError,
    );
    assert.equal(started.attempts, 1);
  });
});
