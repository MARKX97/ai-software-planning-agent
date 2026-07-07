/**
 * Workflow stage identifiers — mirrors the `WorkflowStage` enum in the Prisma
 * schema (`packages/database/prisma/schema.prisma`) and the canonical list in
 * `specs/state-machine.spec.md` §1.
 *
 * Order matters: `WORKFLOW_STAGES_ORDERED` lists the 9 execution stages in the
 * exact pipeline order; `init`/`completed`/`failed` are terminal/structural
 * stages excluded from the ordered list.
 *
 * @internal
 */
export const WorkflowStage = {
  INIT: 'init',
  REQUIREMENT_ANALYSIS: 'requirement_analysis',
  REQUIREMENT_CLARIFICATION: 'requirement_clarification',
  MULTI_MODEL_ANALYSIS: 'multi_model_analysis',
  REQUIREMENT_SYNTHESIS: 'requirement_synthesis',
  FEASIBILITY_ANALYSIS: 'feasibility_analysis',
  RISK_ANALYSIS: 'risk_analysis',
  MVP_COMPRESSION: 'mvp_compression',
  PLATFORM_RECOMMENDATION: 'platform_recommendation',
  PLANNING_GENERATION: 'planning_generation',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type WorkflowStage = (typeof WorkflowStage)[keyof typeof WorkflowStage];

/** All 12 stage identifiers (including terminal states). */
export const WORKFLOW_STAGES: readonly WorkflowStage[] = [
  WorkflowStage.INIT,
  WorkflowStage.REQUIREMENT_ANALYSIS,
  WorkflowStage.REQUIREMENT_CLARIFICATION,
  WorkflowStage.MULTI_MODEL_ANALYSIS,
  WorkflowStage.REQUIREMENT_SYNTHESIS,
  WorkflowStage.FEASIBILITY_ANALYSIS,
  WorkflowStage.RISK_ANALYSIS,
  WorkflowStage.MVP_COMPRESSION,
  WorkflowStage.PLATFORM_RECOMMENDATION,
  WorkflowStage.PLANNING_GENERATION,
  WorkflowStage.COMPLETED,
  WorkflowStage.FAILED,
];

/** The 9 execution stages in pipeline order (excludes init/completed/failed). */
export const WORKFLOW_STAGES_ORDERED: readonly WorkflowStage[] = [
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

/** Terminal stages — no further transitions allowed. */
export const TERMINAL_STAGES: readonly WorkflowStage[] = [
  WorkflowStage.COMPLETED,
  WorkflowStage.FAILED,
];
