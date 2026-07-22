import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStage } from '@ai-planning/shared';
import { buildWorkflowContext } from '../../src/modules/workflow/workflow-executor.js';
import { confirmCheckpointDecision } from '../../src/modules/workflow/workflow-decisions.js';

const snapshot = {
  stage: WorkflowStage.REQUIREMENT_SYNTHESIS,
  summary: '只服务独立开发者',
  decisions: ['首版不做团队协作'],
  user_feedback: ['先验证单人流程'],
  confirmed_at: '2026-07-22T00:00:00.000Z',
};

describe('V2 controlled workflow context', () => {
  it('loads confirmed decisions without leaking unrelated conversation history', async () => {
    const db = {
      client: {
        conversation: {
          findMany: async () => [
            {
              id: 'old',
              messages: [
                { role: 'user', content: 'unrelated old discussion', metadata: null },
                {
                  role: 'assistant',
                  content: '已确认',
                  metadata: { kind: 'decision_snapshot', snapshot },
                },
              ],
            },
            {
              id: 'current',
              messages: [{ role: 'user', content: 'current checkpoint', metadata: null }],
            },
          ],
        },
        analysisResult: { findMany: async () => [] },
      },
    };

    const context = await buildWorkflowContext(db as never, {
      projectId: 'project-1',
      executionId: 'execution-1',
      originalIdea: 'planning agent',
      conversationId: 'current',
      userMessage: `${'x'.repeat(30_000)}latest reply`,
    });

    assert.deepEqual(context.confirmedDecisions, [snapshot]);
    assert.match(context.conversationHistory, /\[confirmed:requirement_synthesis\]/);
    assert.match(context.conversationHistory, /latest reply$/);
    assert.doesNotMatch(context.conversationHistory, /unrelated old discussion/);
    assert.ok(context.conversationHistory.length <= 24_000);
    assert.equal(context.clarificationRound, 2);
  });

  it('persists the snapshot, stage confirmation and conversation close atomically', async () => {
    const writes: Array<{ readonly kind: string; readonly data: Record<string, unknown> }> = [];
    const tx = {
      workflowState: {
        findUnique: async () => ({
          data_json: {
            executive_summary: '聚焦个人用户',
            scope_boundary: '不包含团队协作',
            _workflow: { waiting_for: 'review' },
          },
        }),
        update: async (args: { data: Record<string, unknown> }) =>
          writes.push({ kind: 'state', data: args.data }),
      },
      conversation: {
        findFirst: async () => ({
          messages: [{ role: 'user', content: '团队功能以后再做' }],
        }),
        update: async (args: { data: Record<string, unknown> }) =>
          writes.push({ kind: 'conversation', data: args.data }),
      },
      message: {
        create: async (args: { data: Record<string, unknown> }) =>
          writes.push({ kind: 'message', data: args.data }),
      },
    };
    const db = { client: { $transaction: async (run: (client: typeof tx) => unknown) => run(tx) } };

    const result = await confirmCheckpointDecision(db as never, {
      projectId: 'project-1',
      conversationId: 'conversation-1',
      stage: WorkflowStage.REQUIREMENT_SYNTHESIS,
    });

    assert.equal(result.summary, '聚焦个人用户');
    assert.deepEqual(result.decisions, ['不包含团队协作']);
    assert.equal(writes.map((write) => write.kind).join(','), 'message,state,conversation');
    assert.equal(
      (
        writes.find((write) => write.kind === 'state')?.data['data_json'] as Record<string, unknown>
      )['_workflow'],
      undefined,
    );
  });
});
