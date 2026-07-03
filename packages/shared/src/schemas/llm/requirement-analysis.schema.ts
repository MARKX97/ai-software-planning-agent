/**
 * Zod mirror of `contracts/schemas/llm/requirement-analysis.json`.
 * @internal
 */
import { z } from 'zod';
import { requirementPointSchema } from './requirement-point.schema.js';

export const requirementAnalysisSchema = z.object({
  project_summary: z.string(),
  target_users: z.array(z.string()),
  core_problems: z.array(z.string()),
  requirement_points: z.array(requirementPointSchema),
  assumptions: z.array(z.string()),
  clarification_questions: z.array(z.string()),
});

export type RequirementAnalysisResult = z.infer<typeof requirementAnalysisSchema>;
