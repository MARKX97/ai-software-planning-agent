import { z } from 'zod';

/**
 * Zod schemas + DTO for the Models endpoints.
 * Source: contracts/openapi.yaml → ModelInfo / ModelListResponse.
 * @internal
 */
const pricingSchema = z.object({
  input_per_1k: z.number(),
  output_per_1k: z.number(),
  currency: z.string().default('CNY'),
});

export const modelCapabilitySchema = z.array(z.string());

export const modelInfoSchema = z.object({
  provider_name: z.string(),
  model_id: z.string(),
  display_name: z.string(),
  pricing: pricingSchema,
  status: z.enum(['available', 'degraded', 'unavailable']),
  capabilities: modelCapabilitySchema,
  max_tokens: z.number().int(),
  description: z.string().optional(),
});

export type ModelInfo = z.infer<typeof modelInfoSchema>;

export interface ModelListResponse {
  items: ModelInfo[];
  total: number;
}
