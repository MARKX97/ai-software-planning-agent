/**
 * StageProcessor contract — every stage processor implements this.
 *
 * Each processor receives the current {@link WorkflowContext} and returns a
 * {@link StageResult} containing the validated structured output. Persistence
 * to `analysis_results` is delegated to the workflow service via the result.
 *
 * @internal
 */
import type { WorkflowStage } from '@ai-planning/shared';
import type { WorkflowContext } from '@ai-planning/shared';
import type { StageResult } from '@ai-planning/shared';

export interface StageProcessor {
  readonly stage: WorkflowStage;
  /** Execute the stage and return its result. */
  execute(ctx: WorkflowContext): Promise<StageResult>;
}
