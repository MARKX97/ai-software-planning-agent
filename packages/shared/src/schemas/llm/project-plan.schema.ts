/**
 * Zod mirror of `contracts/schemas/llm/project-plan.json`.
 * @internal
 */
import { z } from 'zod';

export const projectPlanSchema = z.object({
  phases: z.array(
    z.object({
      name: z.string(),
      duration: z.string(),
      tasks: z.array(z.string()),
    }),
  ),
  architecture_overview: z.string(),
  component_tree: z.array(z.record(z.unknown())),
  data_model: z.array(z.record(z.unknown())),
  api_endpoints: z.array(z.record(z.unknown())),
  development_guide: z.string(),
  ai_coding_prompt: z.string(),
});

export type ProjectPlan = z.infer<typeof projectPlanSchema>;
