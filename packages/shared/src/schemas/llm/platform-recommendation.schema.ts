/**
 * Zod mirror of `contracts/schemas/llm/platform-recommendation.json`.
 * @internal
 */
import { z } from 'zod';

export const platformRecommendationSchema = z.object({
  recommended_platform: z.enum(['web', 'mobile', 'desktop', 'cli', 'api']),
  tech_stack: z.record(z.string()),
  rationale: z.string(),
  alternatives: z.array(z.string()),
  trade_offs: z.string(),
});

export type PlatformRecommendation = z.infer<typeof platformRecommendationSchema>;
