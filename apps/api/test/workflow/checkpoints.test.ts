import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_CLARIFICATION_ROUNDS, WorkflowStage } from '@ai-planning/shared';
import {
  nextStageAfterCheckpoint,
  waitingForUser,
} from '../../src/modules/workflow/workflow-checkpoints.js';

describe('workflow checkpoints', () => {
  const clarificationResult = {
    stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
    structuredOutput: null,
    content: '',
    needsMoreClarification: false,
  };

  it('keeps clarification open until enough replies are collected', () => {
    const needsReply = {
      ...clarificationResult,
      needsMoreClarification: true,
    };

    assert.equal(waitingForUser(needsReply.stage, needsReply, 0), 'reply');
    assert.equal(waitingForUser(needsReply.stage, needsReply, MAX_CLARIFICATION_ROUNDS), 'review');
    assert.equal(waitingForUser(clarificationResult.stage, clarificationResult, 0), 'review');
  });

  it('waits at every decision checkpoint and maps its next stage', () => {
    const checkpoints = [
      [WorkflowStage.REQUIREMENT_CLARIFICATION, WorkflowStage.MULTI_MODEL_ANALYSIS],
      [WorkflowStage.REQUIREMENT_SYNTHESIS, WorkflowStage.FEASIBILITY_ANALYSIS],
      [WorkflowStage.MVP_COMPRESSION, WorkflowStage.PLATFORM_RECOMMENDATION],
      [WorkflowStage.PLATFORM_RECOMMENDATION, WorkflowStage.PLANNING_GENERATION],
    ] as const;

    for (const [stage, nextStage] of checkpoints) {
      const result = {
        ...clarificationResult,
        stage,
      };
      assert.equal(waitingForUser(stage, result, 0), 'review');
      assert.equal(nextStageAfterCheckpoint(stage), nextStage);
    }
  });

  it('does not pause or advance at non-checkpoint stages', () => {
    const result = {
      stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
      structuredOutput: null,
      content: '',
      needsMoreClarification: false,
    };

    assert.equal(waitingForUser(WorkflowStage.RISK_ANALYSIS, result, 0), null);
    assert.equal(nextStageAfterCheckpoint(WorkflowStage.RISK_ANALYSIS), null);
  });
});
