/**
 * Zod mirror of `contracts/schemas/llm/requirement-point.json`.
 * @internal
 */
import { z } from 'zod';

export const requirementPointSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  category: z.string(),
  user_story: z.string().optional(),
});

export type RequirementPoint = z.infer<typeof requirementPointSchema>;
