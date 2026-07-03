/**
 * Zod mirror of `contracts/schemas/llm/conflict-item.json`.
 * @internal
 */
import { z } from 'zod';

export const conflictItemSchema = z.object({
  topic: z.string(),
  positions: z.array(z.string()),
  resolution: z.string().optional(),
});

export type ConflictItem = z.infer<typeof conflictItemSchema>;
