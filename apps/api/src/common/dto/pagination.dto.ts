import { z } from 'zod';

/**
 * Shared offset/limit pagination schema. Defaults match specs/api.spec.md §2
 * (limit default 20, max 100).
 * @internal
 */
export const paginationSchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationSchema>;

/**
 * Generic paginated list response wrapper.
 * @internal
 */
export class PaginatedResponse<T> {
  items: T[];
  total: number;
  offset?: number;
  limit?: number;

  constructor(items: T[], total: number, pagination?: PaginationQuery) {
    this.items = items;
    this.total = total;
    this.offset = pagination?.offset;
    this.limit = pagination?.limit;
  }
}
