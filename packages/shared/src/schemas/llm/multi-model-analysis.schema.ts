/**
 * Zod mirror of `contracts/schemas/llm/multi-model-analysis.json`.
 * @internal
 */
import { z } from 'zod';
import { requirementPointSchema } from './requirement-point.schema.js';

export const multiModelAnalysisSchema = z.object({
  model_name: z.string(),
  requirement_points: z.array(requirementPointSchema),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  unknowns: z.array(z.string()),
  recommendation: z.string(),
});

export type MultiModelAnalysisResult = z.infer<typeof multiModelAnalysisSchema>;
