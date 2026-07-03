/**
 * Retry policy for transient failures. Used by the orchestrator.
 *
 * @internal
 */
export interface IRetryPolicy {
  /** Maximum number of retries after the initial attempt. */
  readonly maxRetries: number;
  /**
   * Compute the delay (ms) before attempt number `attempt` (1-based). Implement
   * exponential backoff per spec §2: 1s → 2s → 4s.
   */
  delayForAttempt(attempt: number): number;
}

/** Returns true if the thrown error should be retried. */
export type RetryPredicate = (error: unknown) => boolean;
