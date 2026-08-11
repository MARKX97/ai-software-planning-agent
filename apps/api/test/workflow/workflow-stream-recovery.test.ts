import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LLMCancelledError } from '@ai-planning/llm-orchestrator';
import { WorkflowStage } from '@ai-planning/shared';
import { recoverStreamFailure } from '../../src/modules/workflow/workflow-executor.js';

describe('workflow stream recovery', () => {
  it('makes an initial run failure retryable', async () => {
    const updates: Update[] = [];

    await recoverStreamFailure(databaseMock(updates) as never, initialRunInput(), new Error());

    assert.equal(updates[0]?.model, 'execution');
    assert.equal(updates[0]?.data['status'], 'failed');
    assert.equal(updates[1]?.model, 'project');
    assert.equal(updates[1]?.data['status'], 'failed');
    assert.equal(updates[1]?.data['current_stage'], WorkflowStage.FAILED);
  });

  it('makes an initial run cancellation retryable', async () => {
    const updates: Update[] = [];

    await recoverStreamFailure(
      databaseMock(updates) as never,
      initialRunInput(),
      new LLMCancelledError(),
    );

    assert.deepEqual(
      updates.map((update) => [update.model, update.data['status'], update.data['current_stage']]),
      [
        ['execution', 'cancelled', undefined],
        ['project', 'failed', WorkflowStage.FAILED],
      ],
    );
  });

  it('restores the clarification checkpoint after a continue failure', async () => {
    const updates: Update[] = [];

    await recoverStreamFailure(
      databaseMock(updates) as never,
      {
        ...initialRunInput(),
        userMessage: '补充信息',
        restoreStageOnFailure: WorkflowStage.REQUIREMENT_CLARIFICATION,
      },
      new Error(),
    );

    assert.equal(updates[1]?.data['current_stage'], WorkflowStage.REQUIREMENT_CLARIFICATION);
    assert.equal(updates[1]?.data['status'], undefined);
  });
});

interface Update {
  model: 'execution' | 'project';
  data: Record<string, unknown>;
}

function initialRunInput() {
  return {
    projectId: 'project-1',
    executionId: 'execution-1',
    originalIdea: 'idea',
    conversationId: 'conversation-1',
    startStage: WorkflowStage.REQUIREMENT_ANALYSIS,
  };
}

function databaseMock(updates: Update[]) {
  const update = (model: Update['model']) => async (input: { data: Record<string, unknown> }) => {
    updates.push({ model, data: input.data });
  };
  return {
    client: {
      workflowExecution: { update: update('execution') },
      project: { update: update('project') },
    },
  };
}
