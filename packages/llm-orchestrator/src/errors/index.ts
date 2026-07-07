/**
 * Orchestrator errors barrel.
 *
 * Re-exports the {@link LLMError} hierarchy from llm-core so consumers (apps/api)
 * only need to depend on @ai-planning/llm-orchestrator per CLAUDE.md §A3 — the
 * orchestrator is the single LLM surface for application code.
 *
 * @internal
 */
export * from './all-models-failed.error.js';
export {
  LLMError,
  LLMTimeoutError,
  LLMRateLimitError,
  LLMAuthError,
  LLMSchemaValidationError,
  LLMNetworkError,
  isRetryable,
} from '@ai-planning/llm-core';
