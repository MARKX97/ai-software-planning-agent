/**
 * Raised when every provider in a {@link LlmOrchestratorService.callMulti} or
 * {@link LlmOrchestratorService.callWithFallback} invocation failed.
 *
 * @internal
 * @see specs/orchestrator.spec.md §4
 */
export class AllModelsFailedError extends Error {
  /** Per-provider error messages for diagnostics. */
  readonly failures: Record<string, string>;
  constructor(message: string, failures: Record<string, string>) {
    super(message);
    this.name = 'AllModelsFailedError';
    this.failures = failures;
  }
}
