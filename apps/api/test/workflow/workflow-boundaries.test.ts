import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../src/common/exception/app-exception.js';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import {
  assertCanContinueWorkflow,
  assertWorkflowNotRunning,
} from '../../src/modules/workflow/workflow-guards.js';
import {
  assertWorkflowInteraction,
  nextCheckpointStage,
} from '../../src/modules/workflow/workflow-interaction-guard.js';
import { workflowFailureMessage } from '../../src/modules/workflow/workflow-execution-state.js';
import { confirmedStateData } from '../../src/modules/workflow/workflow-state-persister.js';

const project = (stage: string, status = 'active') => ({ current_stage: stage, status }) as never;
const workflowStatus = (overrides: Record<string, unknown> = {}) =>
  ({
    conversation_id: 'conversation-1',
    waiting_for: 'review',
    current_stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
    ...overrides,
  }) as never;

describe('workflow boundaries', () => {
  it('blocks duplicate runs only while an execution stage is active', () => {
    assert.throws(
      () => assertWorkflowNotRunning(project(WorkflowStage.RISK_ANALYSIS)),
      (error: unknown) =>
        error instanceof AppException && error.code === ErrorCode.WORKFLOW_ALREADY_RUNNING,
    );
    assert.doesNotThrow(() => assertWorkflowNotRunning(project(WorkflowStage.INIT)));
    assert.doesNotThrow(() =>
      assertWorkflowNotRunning(project(WorkflowStage.RISK_ANALYSIS, 'failed')),
    );
  });

  it('allows continue only from requirement clarification', () => {
    assert.doesNotThrow(() =>
      assertCanContinueWorkflow(project(WorkflowStage.REQUIREMENT_CLARIFICATION)),
    );
    assert.throws(
      () => assertCanContinueWorkflow(project(WorkflowStage.MVP_COMPRESSION)),
      (error: unknown) =>
        error instanceof AppException && error.code === ErrorCode.WORKFLOW_STAGE_NOT_CLARIFICATION,
    );
  });

  it('enforces active conversation and expected interaction type', () => {
    assert.doesNotThrow(() =>
      assertWorkflowInteraction(workflowStatus(), 'conversation-1', 'review'),
    );
    assert.throws(
      () => assertWorkflowInteraction(workflowStatus(), 'other', 'review'),
      AppException,
    );
    assert.throws(
      () =>
        assertWorkflowInteraction(
          workflowStatus({ waiting_for: 'reply' }),
          'conversation-1',
          'review',
        ),
      AppException,
    );
  });

  it('moves review checkpoints only along documented edges', () => {
    assert.equal(
      nextCheckpointStage(
        workflowStatus(),
        'conversation-1',
        WorkflowStage.REQUIREMENT_CLARIFICATION,
      ),
      WorkflowStage.MULTI_MODEL_ANALYSIS,
    );
    assert.throws(
      () => nextCheckpointStage(workflowStatus(), 'conversation-1', WorkflowStage.RISK_ANALYSIS),
      AppException,
    );
  });

  it('removes private workflow metadata without mutating the stored value', () => {
    const stored = { answer: 42, _workflow: { waiting_for: 'review' } };
    assert.deepEqual(confirmedStateData(stored), { answer: 42 });
    assert.deepEqual(stored, { answer: 42, _workflow: { waiting_for: 'review' } });
    assert.equal(confirmedStateData(null), null);
  });

  it('exposes safe application errors and hides unexpected failures', () => {
    assert.equal(
      workflowFailureMessage(AppException.conflict(ErrorCode.WORKFLOW_ALREADY_RUNNING, 'busy')),
      'busy',
    );
    assert.equal(
      workflowFailureMessage(new Error('database password leaked')),
      '工作流执行失败，请稍后重试。',
    );
  });
});
