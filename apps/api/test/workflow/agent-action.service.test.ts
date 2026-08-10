import assert from 'node:assert/strict';
import { it } from 'node:test';
import { WorkflowStage, type LLMResponse, type WorkflowContext } from '@ai-planning/shared';
import { AgentActionService } from '../../src/modules/workflow/graph/agent-action.service.js';

it('repairs an invalid Action plan once before executing validated actions', async () => {
  let calls = 0;
  let logs = 0;
  const orchestrator = {
    callSingle: async (): Promise<LLMResponse> => response(++calls === 1 ? {} : { actions: [] }),
    syncProjectCost: () => false,
  };
  const db = {
    client: {
      knowledgeSource: {
        findMany: async () => [
          { id: 'source-1', kind: 'upload', name: 'context.md', revisions: [] },
        ],
      },
      artifact: { findMany: async () => [] },
      tokenUsage: {
        findUnique: async () => null,
        upsert: async () => undefined,
      },
      promptVersion: { findFirst: async () => null },
      modelExecutionLog: {
        create: async () => {
          logs += 1;
        },
        aggregate: async () => ({ _avg: { latency_ms: 1 } }),
      },
    },
  };
  const service = new AgentActionService(
    { agentActionsEnabled: true } as never,
    db as never,
    orchestrator as never,
  );
  Object.assign(service, { tools: { runMany: async () => [] } });

  const result = await service.prepare({
    graphRunId: 'graph-run-1',
    context: workflowContext(),
    stage: WorkflowStage.PLANNING_GENERATION,
  });
  assert.equal(calls, 2);
  assert.equal(logs, 2);
  assert.equal(result.agentContext, undefined);
});

function response(structuredOutput: unknown): LLMResponse {
  return {
    provider: 'glm',
    model: 'glm',
    content: JSON.stringify(structuredOutput),
    structuredOutput,
    usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
    cost: { inputCost: 0, outputCost: 0, cachedInputCost: 0, totalCost: 0 },
    latencyMs: 1,
    retries: 0,
    timestamp: new Date(0).toISOString(),
  };
}

function workflowContext(): WorkflowContext {
  return {
    projectId: 'project-1',
    executionId: 'execution-1',
    originalIdea: 'Build a planning agent',
    conversationHistory: '',
    confirmedDecisions: [],
    clarificationRound: 0,
    resultsByStage: {},
  };
}
