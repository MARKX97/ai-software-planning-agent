import type { IRetryPolicy } from '../interfaces/iretry-policy.js';

/**
 * Default exponential-backoff retry policy: 3 retries max, delays 1s → 2s → 4s.
 *
 * @internal
 * @see specs/orchestrator.spec.md §2
 */
export const DEFAULT_RETRY_POLICY: IRetryPolicy = {
  maxRetries: 3,
  delayForAttempt(attempt: number): number {
    return Math.pow(2, attempt - 1) * 1000;
  },
};

/** Convenience factory mirroring {@link DEFAULT_RETRY_POLICY}. */
export function createRetryPolicy(): IRetryPolicy {
  return DEFAULT_RETRY_POLICY;
}
