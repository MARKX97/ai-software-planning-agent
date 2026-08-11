import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WorkflowStage, type LLMResponse, type StageResult } from '@ai-planning/shared';
import { ArtifactFileStore } from '../../src/modules/workflow/artifact-generation/artifact-file-store.js';
import {
  loadIdempotentStageResult,
  persistAnalysisResult,
} from '../../src/modules/workflow/stages/analysis-result-persister.js';
import { logModelCall } from '../../src/modules/workflow/stages/model-call-log.js';
import { persistWorkflowCheckpoint } from '../../src/modules/workflow/workflow-checkpoint-persistence.js';

const result: StageResult = {
  stage: WorkflowStage.RISK_ANALYSIS,
  structuredOutput: { risks: [] },
  content: 'risk result',
};

describe('Graph durable side-effect idempotency', () => {
  it('reuses one persisted stage result for the same logical attempt', async () => {
    let stored: Record<string, unknown> | undefined;
    const db = {
      client: {
        analysisResult: {
          upsert: async (input: { create: Record<string, unknown> }) => {
            stored ??= input.create;
          },
          findUnique: async () => (stored ? { result_json: stored['result_json'] } : null),
        },
      },
    };
    const input = {
      db: db as never,
      projectId: 'project-1',
      executionId: 'execution-1',
      stage: WorkflowStage.RISK_ANALYSIS,
      result,
      graphRunId: '11111111-1111-4111-8111-111111111111',
      logicalAttempt: 2,
    };
    await persistAnalysisResult(input);
    await persistAnalysisResult({ ...input, executionId: 'execution-2' });
    assert.equal(stored?.['execution_id'], 'execution-1');
    assert.deepEqual(
      await loadIdempotentStageResult({
        db: db as never,
        stage: input.stage,
        graphRunId: input.graphRunId,
        logicalAttempt: input.logicalAttempt,
      }),
      result,
    );
  });

  it('counts a replayed model log and its Token usage once', async () => {
    const keys = new Set<string>();
    let stored: Record<string, unknown> | undefined;
    let tokenUpdates = 0;
    const transactionClient = {
      modelExecutionLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const key = String(data['idempotency_key'] ?? '');
          if (keys.has(key)) throw { code: 'P2002' };
          keys.add(key);
          stored = data;
        },
        aggregate: async () => ({ _avg: { latency_ms: 1 } }),
      },
      tokenUsage: {
        upsert: async () => {
          tokenUpdates += 1;
        },
      },
    };
    const db = {
      client: {
        graphRun: {
          findFirst: async () => ({
            id: '11111111-1111-4111-8111-111111111111',
            logical_attempt: 2,
          }),
        },
        promptVersion: { findFirst: async () => null },
        ...transactionClient,
        $transaction: (run: (tx: typeof transactionClient) => unknown) => run(transactionClient),
      },
    };
    const entry = {
      projectId: 'project-1',
      executionId: 'execution-1',
      stage: WorkflowStage.RISK_ANALYSIS,
      provider: 'deepseek',
      promptText: 'stable prompt',
      response: llmResponse(),
    };
    await logModelCall(db as never, entry);
    await logModelCall(db as never, { ...entry, executionId: 'execution-2' });
    assert.equal(keys.size, 1);
    assert.equal(tokenUpdates, 1);
    assert.match(String(stored?.['prompt_hash']), /^[a-f0-9]{64}$/);
    assert.equal(stored?.['prompt_length'], entry.promptText.length);
    assert.equal('prompt_text' in (stored ?? {}), false);
    assert.equal('response_text' in (stored ?? {}), false);
    assert.equal('structured_output' in (stored ?? {}), false);
  });

  it('rolls back the model log when Token usage persistence fails', async () => {
    const keys = new Set<string>();
    let tokenUpdates = 0;
    let failTokenUpdate = true;
    const db = transactionalModelLogDb({
      keys,
      tokenUpdates: () => tokenUpdates,
      setTokenUpdates: (value) => {
        tokenUpdates = value;
      },
      failTokenUpdate: () => {
        if (!failTokenUpdate) return false;
        failTokenUpdate = false;
        return true;
      },
    });
    const entry = {
      projectId: 'project-1',
      executionId: 'execution-1',
      stage: WorkflowStage.RISK_ANALYSIS,
      provider: 'deepseek',
      promptText: 'stable prompt',
      response: llmResponse(),
    };

    await assert.rejects(() => logModelCall(db as never, entry), /injected Token failure/);
    assert.equal(keys.size, 0);
    assert.equal(tokenUpdates, 0);
    await logModelCall(db as never, entry);
    assert.equal(keys.size, 1);
    assert.equal(tokenUpdates, 1);
  });

  it('returns the previously committed artifact before writing a replay file', async () => {
    let writes = 0;
    const existing = { id: 'artifact-1', content: '# Existing' };
    const db = {
      client: {
        artifact: {
          findUnique: async () => existing,
          updateMany: async () => {
            writes += 1;
          },
          create: async () => {
            writes += 1;
          },
        },
      },
    };
    const saved = await new ArtifactFileStore(db as never, '/unused').save({
      projectId: 'project-1',
      type: 'prd',
      content: '# Replay',
      idempotencyKey: 'graph:planning:1:prd',
    });
    assert.equal(saved.id, 'artifact-1');
    assert.equal(writes, 0);
  });

  it('reuses checkpoint messages before a replay can duplicate the interaction', async () => {
    const fixture = checkpointDb();
    const context = {
      projectId: 'project-1',
      executionId: 'execution-1',
      graphRunId: '11111111-1111-4111-8111-111111111111',
      logicalAttempt: 2,
      originalIdea: 'idea',
      conversationHistory: '',
      confirmedDecisions: [],
      clarificationRound: 1,
      resultsByStage: {},
    };
    const input = {
      db: fixture.db as never,
      workflowConversationId: 'conversation-1',
      userMessage: '补充信息',
      context,
      result: {
        stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
        content: '请继续确认',
        structuredOutput: { clarification_questions: [{ question: '范围？' }] },
      },
      waitingFor: 'reply' as const,
    };

    const first = await persistWorkflowCheckpoint(input);
    const replay = await persistWorkflowCheckpoint(input);

    assert.equal(replay.id, first.id);
    assert.equal(fixture.messages.size, 2);
    assert.equal(fixture.conversations(), 0);
  });

  it('creates one review conversation and message across checkpoint replay', async () => {
    const fixture = checkpointDb();
    const input = {
      db: fixture.db as never,
      workflowConversationId: 'conversation-1',
      context: {
        projectId: 'project-1',
        executionId: 'execution-1',
        graphRunId: '11111111-1111-4111-8111-111111111111',
        logicalAttempt: 1,
        originalIdea: 'idea',
        conversationHistory: '',
        confirmedDecisions: [],
        clarificationRound: 1,
        resultsByStage: {},
      },
      result: {
        stage: WorkflowStage.REQUIREMENT_SYNTHESIS,
        content: '需求已整理',
        structuredOutput: {},
      },
      waitingFor: 'review' as const,
    };

    const first = await persistWorkflowCheckpoint(input);
    const replay = await persistWorkflowCheckpoint(input);

    assert.equal(replay.id, first.id);
    assert.equal(fixture.messages.size, 1);
    assert.equal(fixture.conversations(), 1);
  });
});

function transactionalModelLogDb(input: {
  keys: Set<string>;
  tokenUpdates: () => number;
  setTokenUpdates: (value: number) => void;
  failTokenUpdate: () => boolean;
}) {
  const graphRun = {
    findFirst: async () => ({ id: '11111111-1111-4111-8111-111111111111', logical_attempt: 2 }),
  };
  return {
    client: {
      graphRun,
      promptVersion: { findFirst: async () => null },
      $transaction: async (run: (tx: unknown) => Promise<void>) => {
        const pendingKeys = new Set(input.keys);
        let pendingUpdates = input.tokenUpdates();
        const tx = {
          modelExecutionLog: {
            create: async ({ data }: { data: Record<string, unknown> }) => {
              const key = String(data['idempotency_key']);
              if (pendingKeys.has(key)) throw { code: 'P2002' };
              pendingKeys.add(key);
            },
            aggregate: async () => ({ _avg: { latency_ms: 1 } }),
          },
          tokenUsage: {
            upsert: async () => {
              if (input.failTokenUpdate()) throw new Error('injected Token failure');
              pendingUpdates += 1;
            },
          },
        };
        await run(tx);
        input.keys.clear();
        for (const key of pendingKeys) input.keys.add(key);
        input.setTokenUpdates(pendingUpdates);
      },
    },
  };
}

function checkpointDb() {
  const messages = new Map<string, Record<string, unknown>>();
  let conversations = 0;
  const message = {
    findUnique: async (input: { where: { idempotency_key: string } }) =>
      messages.get(input.where.idempotency_key) ?? null,
    create: async (input: { data: Record<string, unknown> }) => {
      const row = messageRow(input.data, `message-${messages.size + 1}`);
      messages.set(String(input.data['idempotency_key'] ?? row.id), row);
      return row;
    },
    upsert: async (input: {
      where: { idempotency_key: string };
      create: Record<string, unknown>;
    }) => {
      const existing = messages.get(input.where.idempotency_key);
      if (existing) return existing;
      const row = messageRow(input.create, `message-${messages.size + 1}`);
      messages.set(input.where.idempotency_key, row);
      return row;
    },
  };
  const conversation = {
    create: async () => ({ id: `conversation-${++conversations}` }),
    delete: async () => {
      conversations -= 1;
    },
    update: async () => undefined,
  };
  return {
    messages,
    conversations: () => conversations,
    db: {
      client: {
        message,
        conversation,
        $transaction: (
          run: (tx: { message: typeof message; conversation: typeof conversation }) => unknown,
        ) => run({ message, conversation }),
      },
    },
  };
}

function messageRow(data: Record<string, unknown>, id: string) {
  return {
    id,
    conversation_id: data['conversation_id'],
    role: data['role'],
    content: data['content'],
    metadata: data['metadata'] ?? null,
    idempotency_key: data['idempotency_key'] ?? null,
    created_at: new Date(0),
  };
}

function llmResponse(): LLMResponse {
  return {
    provider: 'deepseek',
    model: 'deepseek',
    content: 'response',
    structuredOutput: {},
    usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0, totalTokens: 2 },
    cost: { inputCost: 1, outputCost: 1, cachedInputCost: 0, totalCost: 2 },
    latencyMs: 1,
    retries: 0,
    timestamp: new Date(0).toISOString(),
  };
}
