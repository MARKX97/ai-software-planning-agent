import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WorkflowStage } from '@ai-planning/shared';
import { WorkflowStateMachine } from '../../src/modules/workflow/state-machine/workflow-state-machine.js';

const sm = new WorkflowStateMachine();

describe('WorkflowStateMachine — valid transitions', () => {
  it('allows INIT → REQUIREMENT_ANALYSIS', () => {
    assert.equal(sm.canTransition(WorkflowStage.INIT, WorkflowStage.REQUIREMENT_ANALYSIS), true);
  });

  it('allows REQUIREMENT_ANALYSIS → REQUIREMENT_CLARIFICATION', () => {
    assert.equal(
      sm.canTransition(WorkflowStage.REQUIREMENT_ANALYSIS, WorkflowStage.REQUIREMENT_CLARIFICATION),
      true,
    );
  });

  it('allows the clarification loop edge (REQUIREMENT_CLARIFICATION → REQUIREMENT_ANALYSIS)', () => {
    assert.equal(
      sm.canTransition(WorkflowStage.REQUIREMENT_CLARIFICATION, WorkflowStage.REQUIREMENT_ANALYSIS),
      true,
    );
  });

  it('allows REQUIREMENT_CLARIFICATION → MULTI_MODEL_ANALYSIS', () => {
    assert.equal(
      sm.canTransition(WorkflowStage.REQUIREMENT_CLARIFICATION, WorkflowStage.MULTI_MODEL_ANALYSIS),
      true,
    );
  });

  it('allows every stage → FAILED', () => {
    const running: WorkflowStage[] = [
      WorkflowStage.REQUIREMENT_ANALYSIS,
      WorkflowStage.REQUIREMENT_CLARIFICATION,
      WorkflowStage.MULTI_MODEL_ANALYSIS,
      WorkflowStage.REQUIREMENT_SYNTHESIS,
      WorkflowStage.FEASIBILITY_ANALYSIS,
      WorkflowStage.RISK_ANALYSIS,
      WorkflowStage.MVP_COMPRESSION,
      WorkflowStage.PLATFORM_RECOMMENDATION,
      WorkflowStage.PLANNING_GENERATION,
    ];
    for (const stage of running) {
      assert.equal(sm.canTransition(stage, WorkflowStage.FAILED), true, `${stage} → FAILED`);
    }
  });

  it('allows PLANNING_GENERATION → COMPLETED', () => {
    assert.equal(
      sm.canTransition(WorkflowStage.PLANNING_GENERATION, WorkflowStage.COMPLETED),
      true,
    );
  });
});

describe('WorkflowStateMachine — invalid transitions', () => {
  it('rejects INIT → COMPLETED (skipping pipeline)', () => {
    assert.equal(sm.canTransition(WorkflowStage.INIT, WorkflowStage.COMPLETED), false);
  });

  it('rejects REQUIREMENT_ANALYSIS → MULTI_MODEL_ANALYSIS (skipping clarification)', () => {
    assert.equal(
      sm.canTransition(WorkflowStage.REQUIREMENT_ANALYSIS, WorkflowStage.MULTI_MODEL_ANALYSIS),
      false,
    );
  });

  it('rejects COMPLETED → anything (terminal)', () => {
    assert.equal(sm.canTransition(WorkflowStage.COMPLETED, WorkflowStage.FAILED), false);
  });

  it('rejects FAILED → anything (terminal)', () => {
    assert.equal(sm.canTransition(WorkflowStage.FAILED, WorkflowStage.COMPLETED), false);
  });

  it('rejects reverse transitions', () => {
    assert.equal(
      sm.canTransition(WorkflowStage.MULTI_MODEL_ANALYSIS, WorkflowStage.REQUIREMENT_ANALYSIS),
      false,
    );
  });
});

describe('WorkflowStateMachine — transition throws on illegal move', () => {
  it('throws Error on illegal transition', () => {
    assert.throws(
      () => sm.transition(WorkflowStage.INIT, WorkflowStage.COMPLETED),
      /Invalid workflow stage transition/,
    );
  });

  it('returns target stage on legal transition', () => {
    const next = sm.transition(WorkflowStage.INIT, WorkflowStage.REQUIREMENT_ANALYSIS);
    assert.equal(next, WorkflowStage.REQUIREMENT_ANALYSIS);
  });
});

describe('WorkflowStateMachine — nextStage', () => {
  it('returns the canonical next stage for each non-terminal stage', () => {
    assert.equal(sm.nextStage(WorkflowStage.INIT), WorkflowStage.REQUIREMENT_ANALYSIS);
    assert.equal(
      sm.nextStage(WorkflowStage.REQUIREMENT_ANALYSIS),
      WorkflowStage.REQUIREMENT_CLARIFICATION,
    );
    assert.equal(
      sm.nextStage(WorkflowStage.REQUIREMENT_CLARIFICATION),
      WorkflowStage.MULTI_MODEL_ANALYSIS,
    );
    assert.equal(sm.nextStage(WorkflowStage.PLANNING_GENERATION), WorkflowStage.COMPLETED);
  });

  it('throws when called on a terminal stage', () => {
    assert.throws(() => sm.nextStage(WorkflowStage.COMPLETED), /No next stage after 'completed'/);
  });
});

describe('WorkflowStateMachine — progressPercent', () => {
  it('returns 0% for init', () => {
    assert.equal(sm.progressPercent(WorkflowStage.INIT), 0);
  });

  it('returns 100% for completed', () => {
    assert.equal(sm.progressPercent(WorkflowStage.COMPLETED), 100);
  });

  it('returns increasing percentages along the pipeline', () => {
    const p1 = sm.progressPercent(WorkflowStage.REQUIREMENT_CLARIFICATION);
    const p2 = sm.progressPercent(WorkflowStage.MULTI_MODEL_ANALYSIS);
    const p3 = sm.progressPercent(WorkflowStage.PLANNING_GENERATION);
    assert.ok(p1 < p2 && p2 < p3, `${p1} < ${p2} < ${p3}`);
  });
});

describe('WorkflowStateMachine — isTerminal', () => {
  it('identifies COMPLETED and FAILED as terminal', () => {
    assert.equal(sm.isTerminal(WorkflowStage.COMPLETED), true);
    assert.equal(sm.isTerminal(WorkflowStage.FAILED), true);
  });

  it('identifies running stages as non-terminal', () => {
    assert.equal(sm.isTerminal(WorkflowStage.INIT), false);
    assert.equal(sm.isTerminal(WorkflowStage.PLANNING_GENERATION), false);
  });
});
