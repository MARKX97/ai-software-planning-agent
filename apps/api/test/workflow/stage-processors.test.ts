import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStage, type LLMResponse, type WorkflowContext } from '@ai-planning/shared';
import { AllModelsFailedError, LLMNetworkError } from '@ai-planning/llm-orchestrator';
import { AppException } from '../../src/common/exception/app-exception.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { runPipeline } from '../../src/modules/workflow/workflow-pipeline-runner.js';
import { markFailed } from '../../src/modules/workflow/workflow-store.js';
import { RequirementClarificationStage } from '../../src/modules/workflow/stages/requirement-clarification.stage.js';
import { MultiModelAnalysisStage } from '../../src/modules/workflow/stages/multi-model-analysis.stage.js';

const context: WorkflowContext = {
  projectId: 'project-1',
  executionId: 'execution-1',
  originalIdea: 'planning agent',
  conversationHistory: 'user reply',
  confirmedDecisions: [],
  clarificationRound: 0,
  resultsByStage: {
    [WorkflowStage.REQUIREMENT_ANALYSIS]: {
      stage: WorkflowStage.REQUIREMENT_ANALYSIS,
      content: 'analysis',
      structuredOutput: {
        clarification_questions: [
          { question: 'scope?', context: 'scope matters', category: 'scope' },
        ],
      },
    },
  } as never,
};

function response(provider: string, structuredOutput: unknown): LLMResponse {
  return {
    provider,
    model: provider,
    content: JSON.stringify(structuredOutput),
    structuredOutput,
    usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
    cost: { inputCost: 0, outputCost: 0, cachedInputCost: 0, totalCost: 0 },
    latencyMs: 1,
    retries: 0,
    timestamp: new Date(0).toISOString(),
  };
}

function db(logs: unknown[]) {
  return {
    client: {
      modelExecutionLog: {
        create: async (entry: unknown) => logs.push(entry),
        aggregate: async () => ({ _avg: { latency_ms: 1 } }),
      },
      tokenUsage: { upsert: async () => undefined },
      promptVersion: { findFirst: async () => ({ id: 'prompt-v1' }) },
    },
  };
}

describe('workflow stage processors', () => {
  it('returns clarification decisions and persists the model call', async () => {
    for (const needsMore of [true, false]) {
      const logs: unknown[] = [];
      const stage = new RequirementClarificationStage({
        orchestrator: {
          callSingle: async () => response('glm', null),
        },
        db: db(logs),
      } as never);
      const result = await stage.execute({
        ...context,
        clarificationRound: needsMore ? 0 : 5,
      });
      assert.equal(
        (result as { needsMoreClarification: boolean }).needsMoreClarification,
        needsMore,
      );
      assert.equal(logs.length, 1);
      assert.equal((logs[0] as { data: { attempt_number: number } }).data.attempt_number, 1);
      assert.equal(
        (logs[0] as { data: { prompt_version_id: string } }).data.prompt_version_id,
        'prompt-v1',
      );
    }
  });

  it('persists failed dialogue providers before the fallback success', async () => {
    const logs: Array<{ data: Record<string, unknown> }> = [];
    const stage = new RequirementClarificationStage({
      orchestrator: {
        callSingleStreamWithFallback: async (
          _providers: string[],
          _prompt: string,
          options: {
            onProviderFailure: (attempt: Record<string, unknown>) => Promise<void>;
          },
        ) => {
          await options.onProviderFailure({
            provider: 'glm',
            model: 'glm-model',
            attemptNumber: 1,
            latencyMs: 20,
            errorCode: 'LLM_NETWORK_ERROR',
            errorMessage: 'api_key=abcdefghijklmnopqrstuvwxyz1234',
          });
          return response('minimax', null);
        },
      },
      db: db(logs),
      stream: { onDelta: () => {} },
    } as never);
    await stage.execute(context);
    assert.equal(logs.length, 2);
    assert.equal(logs[0].data['provider_name'], 'glm');
    assert.equal(logs[0].data['attempt_number'], 1);
    assert.equal(logs[0].data['error_message'], '[REDACTED]');
    assert.equal(logs[1].data['provider_name'], 'minimax');
    assert.equal(logs[1].data['attempt_number'], 2);
  });

  it('reports 3/3, 2/3 and 1/3 multi-model degradation levels', async () => {
    for (const successCount of [3, 2, 1]) {
      const providers = ['deepseek', 'glm', 'minimax'].map((provider, index) => [
        provider,
        index < successCount ? response(provider, { model_name: provider }) : null,
      ]);
      const logs: unknown[] = [];
      const stage = new MultiModelAnalysisStage({
        orchestrator: { callMulti: async () => Object.fromEntries(providers) },
        db: db(logs),
      } as never);
      const result = await stage.execute(context);
      assert.equal((result as { successCount: number }).successCount, successCount);
      assert.equal(logs.length, 3);
    }
  });

  it('propagates all-model failure for the workflow runner to handle', async () => {
    const stage = new MultiModelAnalysisStage({
      orchestrator: {
        callMulti: async () => {
          throw new AllModelsFailedError(['deepseek', 'glm', 'minimax']);
        },
      },
      db: db([]),
    } as never);
    await assert.rejects(() => stage.execute(context), AllModelsFailedError);
  });

  it('maps provider network failures to a user-facing workflow error', async () => {
    const failingContext = { ...context, resultsByStage: {} as never };
    const failingDb = {
      client: {
        project: { update: async () => undefined },
        workflowState: { upsert: async () => undefined },
      },
    };
    const orchestrator = {
      callSingle: async () => {
        throw new LLMNetworkError('fetch failed');
      },
    };

    await assert.rejects(
      () =>
        runPipeline(failingContext, {
          db: failingDb as never,
          orchestrator: orchestrator as never,
          dataDir: '/tmp',
        }),
      (error: unknown) =>
        error instanceof AppException &&
        error.code === ErrorCode.LLM_NETWORK_ERROR &&
        error.message === '暂时无法连接模型服务，请稍后重试。',
    );
  });

  it('does not persist raw unexpected workflow errors', async () => {
    const messages: string[] = [];
    const failingDb = {
      client: {
        workflowExecution: {
          update: async (args: { data: { error_message: string } }) =>
            messages.push(args.data.error_message),
        },
        project: {
          update: async (args: { data: { error_message: string } }) =>
            messages.push(args.data.error_message),
        },
      },
    };

    await markFailed(failingDb as never, 'project-1', 'execution-1', new Error('fetch failed'));
    assert.deepEqual(messages, ['工作流执行失败，请稍后重试。', '工作流执行失败，请稍后重试。']);
  });
});
