/**
 * Zod mirror of `contracts/schemas/llm/platform-recommendation.json`.
 * @internal
 */
import { z } from 'zod';

export const platformRecommendationSchema = z.object({
  recommended_platform: z.string(),
  tech_stack: z.array(z.string()),
  rationale: z.string(),
  alternatives: z.array(z.string()),
  trade_offs: z.string(),
});

export type PlatformRecommendation = z.infer<typeof platformRecommendationSchema>;
