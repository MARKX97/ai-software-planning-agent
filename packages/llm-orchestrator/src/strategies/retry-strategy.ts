import { createRetryPolicy, isRetryable } from '@ai-planning/llm-core';
import type { ILLMProvider } from '@ai-planning/llm-core';
import type { LLMCallOptions, LLMResponse, LLMStreamOptions } from '@ai-planning/shared';

/**
 * Execute a single provider call with exponential-backoff retry.
 *
 * @internal
 * @see specs/orchestrator.spec.md §2
 */
export async function callWithRetry(
  provider: ILLMProvider,
  prompt: string,
  options: LLMCallOptions,
): Promise<{ response: LLMResponse; retries: number }> {
  const policy = createRetryPolicy();
  for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
    try {
      const response = await provider.chat(prompt, options);
      return { response, retries: attempt };
    } catch (error) {
      if (!isRetryable(error) || attempt === policy.maxRetries) {
        throw error;
      }
      await sleep(policy.delayForAttempt(attempt + 1));
    }
  }
  // Unreachable: the loop body always returns or throws on the final attempt.
  throw new Error('callWithRetry: unreachable');
}

/** Retry a stream only while no content has reached the caller. */
export async function callStreamWithRetry(
  provider: ILLMProvider,
  prompt: string,
  options: LLMStreamOptions,
): Promise<{ response: LLMResponse; retries: number }> {
  const policy = createRetryPolicy();
  for (let attempt = 0; attempt <= policy.maxRetries; attempt += 1) {
    let emitted = false;
    try {
      const response = await provider.chatStream(prompt, {
        ...options,
        onDelta: async (content) => {
          emitted = true;
          await options.onDelta(content);
        },
      });
      return { response, retries: attempt };
    } catch (error) {
      if (emitted || !isRetryable(error) || attempt === policy.maxRetries) throw error;
      await sleep(policy.delayForAttempt(attempt + 1));
    }
  }
  throw new Error('callStreamWithRetry: unreachable');
}

/** Test-injectable sleep helper (avoids real timers). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
