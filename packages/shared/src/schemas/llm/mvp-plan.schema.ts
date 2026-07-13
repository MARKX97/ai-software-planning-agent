/**
 * Zod mirror of `contracts/schemas/llm/mvp-plan.json`.
 * @internal
 */
import { z } from 'zod';
import { requirementPointSchema } from './requirement-point.schema.js';

export const mvpPlanSchema = z.object({
  mvp_scope: z.array(requirementPointSchema),
  deferred_scope: z.array(requirementPointSchema),
  mvp_goal: z.string(),
  success_metrics: z.array(z.string()),
  timeline: z.string(),
  milestones: z.array(z.string()),
});

export type MVPPlan = z.infer<typeof mvpPlanSchema>;
