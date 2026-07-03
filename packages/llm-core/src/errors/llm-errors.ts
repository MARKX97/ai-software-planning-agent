/**
 * LLM error hierarchy.
 *
 * Distinguished from generic `Error` so the orchestrator retry policy can
 * decide retryability (see specs/orchestrator.spec.md §2): timeouts / rate
 * limits / network errors retry; auth / schema-validation errors do not.
 *
 * @internal
 */

/** Base class for all LLM-domain errors. */
export abstract class LLMError extends Error {
  /** Stable error code (matches `LLM_*` codes surfaced to clients). */
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
  }
}

/** Raised when a provider call exceeds its timeout. Retryable. */
export class LLMTimeoutError extends LLMError {
  constructor(message = 'LLM call timed out') {
    super('LLM_TIMEOUT', message);
  }
}

/** Raised when the gateway responds with HTTP 429. Retryable. */
export class LLMRateLimitError extends LLMError {
  constructor(message = 'LLM rate limit exceeded') {
    super('RATE_LIMITED', message);
  }
}

/** Raised on HTTP 401/403 — invalid key. Not retryable. */
export class LLMAuthError extends LLMError {
  constructor(message = 'LLM authentication failed') {
    super('LLM_AUTH_ERROR', message);
  }
}

/**
 * Raised when the model output cannot be parsed as JSON or fails the provided
 * zod schema. Per specs/provider.spec.md §2 the provider degrades to
 * `structuredOutput = null` rather than throwing — this error is only surfaced
 * when structured output is strictly required. Not retryable.
 */
export class LLMSchemaValidationError extends LLMError {
  /** Validation issues for diagnostics. */
  readonly issues: unknown;
  constructor(message: string, issues?: unknown) {
    super('LLM_SCHEMA_VALIDATION_ERROR', message);
    this.issues = issues;
  }
}

/** Raised on transient network failures (ECONNRESET, fetch reject). Retryable. */
export class LLMNetworkError extends LLMError {
  constructor(message = 'LLM network error') {
    super('LLM_NETWORK_ERROR', message);
  }
}

/** True for errors the retry policy should retry (spec §2). */
export function isRetryable(error: unknown): boolean {
  return (
    error instanceof LLMTimeoutError ||
    error instanceof LLMRateLimitError ||
    error instanceof LLMNetworkError
  );
}
