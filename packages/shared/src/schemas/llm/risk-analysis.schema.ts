/**
 * Zod mirror of `contracts/schemas/llm/risk-analysis.json`.
 * @internal
 */
import { z } from 'zod';
import { riskItemSchema } from './risk-item.schema.js';

export const riskAnalysisSchema = z.object({
  risks: z.array(riskItemSchema),
  overall_risk_level: z.enum(['high', 'medium', 'low']),
  critical_risks: z.array(z.string()),
});

export type RiskAnalysisResult = z.infer<typeof riskAnalysisSchema>;
