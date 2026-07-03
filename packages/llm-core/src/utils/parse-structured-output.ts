import { z } from 'zod';
import { LLMSchemaValidationError } from '../errors/llm-errors.js';

/**
 * Parse a model's text response into a JSON value.
 *
 * @internal
 * @throws LLMSchemaValidationError when the content is not valid JSON.
 */
export function parseStructuredOutput(content: string): unknown {
  const trimmed = content.trim();
  // Strip optional ```json fenced blocks some models emit.
  const stripped = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
  try {
    return JSON.parse(stripped);
  } catch {
    throw new LLMSchemaValidationError('Model output is not valid JSON', { content: trimmed });
  }
}

/**
 * Validate a parsed value against a zod schema. Returns `{success, data}` and
 * never throws — callers decide how to surface validation failure (provider
 * degrades to `structuredOutput = null`).
 *
 * @internal
 */
export function validateSchema(
  value: unknown,
  schema: z.ZodSchema,
): { success: true; data: unknown } | { success: false; issues: z.ZodIssue[] } {
  const result = schema.safeParse(value);
  if (result.success) return { success: true, data: result.data };
  return { success: false, issues: result.error.issues };
}
