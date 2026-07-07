/**
 * Zod mirror of `contracts/schemas/llm/synthesized-requirement.json`.
 * @internal
 */
import { z } from 'zod';
import { requirementPointSchema } from './requirement-point.schema.js';
import { conflictItemSchema } from './conflict-item.schema.js';

export const synthesizedRequirementSchema = z.object({
  project_name: z.string(),
  executive_summary: z.string(),
  user_personas: z.array(z.string()),
  functional_requirements: z.array(requirementPointSchema),
  non_functional_requirements: z.array(requirementPointSchema),
  conflicts_resolved: z.array(conflictItemSchema),
  scope_boundary: z.string(),
});

export type SynthesizedRequirement = z.infer<typeof synthesizedRequirementSchema>;
