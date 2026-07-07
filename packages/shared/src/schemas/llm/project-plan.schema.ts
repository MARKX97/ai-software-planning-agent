/**
 * Zod mirror of `contracts/schemas/llm/project-plan.json`.
 * @internal
 */
import { z } from 'zod';

export const projectPlanSchema = z.object({
  phases: z.array(z.string()),
  architecture_overview: z.string(),
  component_tree: z.string(),
  data_model: z.string(),
  api_endpoints: z.array(z.string()),
  development_guide: z.string(),
  ai_coding_prompt: z.string(),
});

export type ProjectPlan = z.infer<typeof projectPlanSchema>;
