import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStage, type LLMResponse, type WorkflowContext } from '@ai-planning/shared';
import { AllModelsFailedError } from '@ai-planning/llm-orchestrator';
import { RequirementClarificationStage } from '../../src/modules/workflow/stages/requirement-clarification.stage.js';
import { MultiModelAnalysisStage } from '../../src/modules/workflow/stages/multi-model-analysis.stage.js';

const context: WorkflowContext = {
  projectId: 'project-1',
  executionId: 'execution-1',
  originalIdea: 'planning agent',
  conversationHistory: 'user reply',
  clarificationRound: 0,
  resultsByStage: {
    [WorkflowStage.REQUIREMENT_ANALYSIS]: {
      stage: WorkflowStage.REQUIREMENT_ANALYSIS,
      content: 'analysis',
      structuredOutput: { clarification_questions: ['scope?'] },
    },
  } as never,
};

function response(provider: string, structuredOutput: unknown): LLMResponse {
  return {
    provider,
    model: provider,
    content: JSON.stringify(structuredOutput),
    structuredOutput,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
    latencyMs: 1,
    retries: 0,
    timestamp: new Date(0).toISOString(),
  };
}

function db(logs: unknown[]) {
  return {
    client: {
      modelExecutionLog: { create: async (entry: unknown) => logs.push(entry) },
      tokenUsage: { upsert: async () => undefined },
    },
  };
}

describe('workflow stage processors', () => {
  it('returns clarification decisions and persists the model call', async () => {
    for (const needsMore of [true, false]) {
      const logs: unknown[] = [];
      const stage = new RequirementClarificationStage({
        orchestrator: {
          callSingle: async () =>
            response('glm', {
              needs_more_clarification: needsMore,
              clarification_questions: [],
            }),
        },
        db: db(logs),
      } as never);
      const result = await stage.execute(context);
      assert.equal(
        (result as { needsMoreClarification: boolean }).needsMoreClarification,
        needsMore,
      );
      assert.equal(logs.length, 1);
    }
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
});
