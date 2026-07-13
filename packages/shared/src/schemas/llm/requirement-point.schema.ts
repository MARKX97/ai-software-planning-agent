/**
 * Zod mirror of `contracts/schemas/llm/requirement-point.json`.
 * @internal
 */
import { z } from 'zod';

export const requirementPointSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  priority: z.enum(['P0', 'P1', 'P2', 'P3']),
  category: z.enum(['functional', 'non_functional', 'ux', 'business']),
  user_story: z.string().optional(),
});

export type RequirementPoint = z.infer<typeof requirementPointSchema>;
