/**
 * Helpers mapping Prisma entities → API response DTOs.
 *
 * Prisma fields are already snake_case (schema uses snake field names matching
 * columns), so most mappings are direct; Date fields are converted to ISO 8601
 * strings per specs/api.spec.md §2.
 * @internal
 */

/** Convert a Date (or null) to an ISO string (or null). */
export const toIso = (value: Date | null | undefined): string | null =>
  value ? value.toISOString() : null;

/** Drop `null`/`undefined` keys from an object (for optional response fields). */
export function omitNulls<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) result[key] = value;
  }
  return result as Partial<T>;
}
