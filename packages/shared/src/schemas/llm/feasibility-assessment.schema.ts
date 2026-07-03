/**
 * Zod mirror of `contracts/schemas/llm/feasibility-assessment.json`.
 * @internal
 */
import { z } from 'zod';

export const feasibilityAssessmentSchema = z.object({
  technical_feasibility: z.enum(['high', 'medium', 'low']),
  technical_risks: z.array(z.string()),
  resource_estimation: z.string(),
  timeline_estimation: z.string(),
  dependencies: z.array(z.string()),
  alternative_approaches: z.array(z.string()),
});

export type FeasibilityAssessment = z.infer<typeof feasibilityAssessmentSchema>;
