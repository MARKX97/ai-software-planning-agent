import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStage } from '@ai-planning/shared';
import {
  nextStageAfterCheckpoint,
  waitingForUser,
} from '../../src/modules/workflow/workflow-checkpoints.js';

describe('workflow checkpoints', () => {
  it('waits for review at decision stages and preserves the next stage', () => {
    const result = {
      stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
      structuredOutput: null,
      content: '',
      needsMoreClarification: false,
    };
    assert.equal(waitingForUser(result.stage, result, 0), 'review');
    assert.equal(
      waitingForUser(
        WorkflowStage.MVP_COMPRESSION,
        { ...result, stage: WorkflowStage.MVP_COMPRESSION },
        0,
      ),
      'review',
    );
    assert.equal(
      nextStageAfterCheckpoint(WorkflowStage.PLATFORM_RECOMMENDATION),
      WorkflowStage.PLANNING_GENERATION,
    );
  });
});
