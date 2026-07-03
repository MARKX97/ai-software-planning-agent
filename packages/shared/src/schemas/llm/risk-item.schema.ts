/**
 * Zod mirror of `contracts/schemas/llm/risk-item.json`.
 * @internal
 */
import { z } from 'zod';

export const riskItemSchema = z.object({
  id: z.string(),
  category: z.string(),
  description: z.string(),
  probability: z.enum(['high', 'medium', 'low']),
  impact: z.enum(['high', 'medium', 'low']),
  mitigation: z.string(),
  contingency: z.string(),
});

export type RiskItem = z.infer<typeof riskItemSchema>;
