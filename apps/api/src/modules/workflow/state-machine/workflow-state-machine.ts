/**
 * Deterministic finite state machine for the workflow pipeline.
 *
 * Source: `specs/state-machine.spec.md` §1-5 + `specs/workflow.spec.md` §3.
 *
 * 12 states, 20 transitions, 1 loop edge (clarification → requirement_analysis),
 * 2 terminal states (completed, failed).
 *
 * @internal
 */
import { TERMINAL_STAGES, WorkflowStage } from '@ai-planning/shared';
import { VALID_TRANSITIONS } from './valid-transitions.js';

/** Maps each stage to its `completed_stages` count per spec §5 progress table. */
const STAGE_TO_COMPLETED_COUNT: Record<WorkflowStage, number> = {
  init: 0,
  requirement_analysis: 0,
  requirement_clarification: 1,
  multi_model_analysis: 2,
  requirement_synthesis: 3,
  feasibility_analysis: 4,
  risk_analysis: 5,
  mvp_compression: 6,
  platform_recommendation: 7,
  planning_generation: 8,
  completed: 9,
  failed: 0,
};

const TOTAL_STAGES = 9;

export class WorkflowStateMachine {
  /** True iff the transition is allowed by the VALID_TRANSITIONS table. */
  canTransition(from: WorkflowStage, to: WorkflowStage): boolean {
    return VALID_TRANSITIONS[from].includes(to);
  }

  /**
   * Transition `from` → `to`. Throws on illegal transitions. Returns the new
   * stage (always equal to `to`) so callers can chain assignments.
   */
  transition(from: WorkflowStage, to: WorkflowStage): WorkflowStage {
    if (!this.canTransition(from, to)) {
      throw new Error(
        `Invalid workflow stage transition: '${from}' → '${to}'. Allowed targets from '${from}': [${VALID_TRANSITIONS[from].join(', ')}].`,
      );
    }
    return to;
  }

  /**
   * Returns the canonical next stage in the pipeline order (skipping the
   * clarification loop edge, which is decided by stage logic rather than order).
   */
  nextStage(from: WorkflowStage): WorkflowStage {
    switch (from) {
      case WorkflowStage.INIT:
        return WorkflowStage.REQUIREMENT_ANALYSIS;
      case WorkflowStage.REQUIREMENT_ANALYSIS:
        return WorkflowStage.REQUIREMENT_CLARIFICATION;
      case WorkflowStage.REQUIREMENT_CLARIFICATION:
        return WorkflowStage.MULTI_MODEL_ANALYSIS;
      case WorkflowStage.MULTI_MODEL_ANALYSIS:
        return WorkflowStage.REQUIREMENT_SYNTHESIS;
      case WorkflowStage.REQUIREMENT_SYNTHESIS:
        return WorkflowStage.FEASIBILITY_ANALYSIS;
      case WorkflowStage.FEASIBILITY_ANALYSIS:
        return WorkflowStage.RISK_ANALYSIS;
      case WorkflowStage.RISK_ANALYSIS:
        return WorkflowStage.MVP_COMPRESSION;
      case WorkflowStage.MVP_COMPRESSION:
        return WorkflowStage.PLATFORM_RECOMMENDATION;
      case WorkflowStage.PLATFORM_RECOMMENDATION:
        return WorkflowStage.PLANNING_GENERATION;
      case WorkflowStage.PLANNING_GENERATION:
        return WorkflowStage.COMPLETED;
      default:
        throw new Error(`No next stage after '${from}'`);
    }
  }

  /** Pipeline progress percentage per spec §5 progress table. */
  progressPercent(from: WorkflowStage): number {
    const completed = STAGE_TO_COMPLETED_COUNT[from];
    return Math.round((completed / TOTAL_STAGES) * 1000) / 10;
  }

  /** True iff `stage` is a terminal state (no outgoing transitions). */
  isTerminal(stage: WorkflowStage): boolean {
    return TERMINAL_STAGES.includes(stage);
  }
}
