/**
 * VALID_TRANSITIONS — adjacency matrix of the 17 legal transitions defined in
 * `specs/state-machine.spec.md` §4 and `specs/workflow.spec.md` §5.1.
 *
 * Keys are source stages; values are the set of legal target stages. Used by
 * `WorkflowStateMachine.canTransition` to enforce deterministic transitions.
 *
 * @internal
 */
import type { WorkflowStage } from '@ai-planning/shared';

export const VALID_TRANSITIONS: Readonly<Record<WorkflowStage, readonly WorkflowStage[]>> = {
  init: ['requirement_analysis'],
  requirement_analysis: ['requirement_clarification', 'failed'],
  requirement_clarification: ['requirement_analysis', 'multi_model_analysis', 'failed'],
  multi_model_analysis: ['requirement_synthesis', 'failed'],
  requirement_synthesis: ['feasibility_analysis', 'failed'],
  feasibility_analysis: ['risk_analysis', 'failed'],
  risk_analysis: ['mvp_compression', 'failed'],
  mvp_compression: ['platform_recommendation', 'failed'],
  platform_recommendation: ['planning_generation', 'failed'],
  planning_generation: ['completed', 'failed'],
  completed: [],
  failed: [],
} as const;
