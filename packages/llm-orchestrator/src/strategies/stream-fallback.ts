import { LLMCancelledError, LLMError, type ILLMProvider } from '@ai-planning/llm-core';
import type {
  LLMFallbackAttempt,
  LLMFallbackStreamOptions,
  LLMResponse,
} from '@ai-planning/shared';
import { AllModelsFailedError } from '../errors/all-models-failed.error.js';
import { callStreamWithRetry } from './retry-strategy.js';

export interface StreamFallbackInput {
  readonly providers: ILLMProvider[];
  readonly prompt: string;
  readonly options: LLMFallbackStreamOptions;
  readonly onFailure: (provider: ILLMProvider, startedAt: number) => void;
}

/** Try stream providers in order without ever replacing emitted content. */
export async function callStreamWithFallback(
  input: StreamFallbackInput,
): Promise<{ response: LLMResponse; retries: number; provider: ILLMProvider }> {
  const failures: Record<string, string> = {};
  for (let index = 0; index < input.providers.length; index += 1) {
    const provider = input.providers[index];
    const startedAt = Date.now();
    let emitted = false;
    try {
      const result = await callStreamWithRetry(provider, input.prompt, {
        ...input.options,
        onDelta: async (content) => {
          emitted = true;
          await input.options.onDelta(content);
        },
      });
      return { ...result, provider };
    } catch (error) {
      input.onFailure(provider, startedAt);
      const attempt = toAttempt({ provider, attemptNumber: index + 1, startedAt, error });
      failures[provider.name] = attempt.errorMessage;
      await input.options.onProviderFailure?.(attempt);
      if (emitted || error instanceof LLMCancelledError) throw error;
    }
  }
  throw new AllModelsFailedError('All models failed in callSingleStreamWithFallback', failures);
}

interface AttemptInput {
  readonly provider: ILLMProvider;
  readonly attemptNumber: number;
  readonly startedAt: number;
  readonly error: unknown;
}

function toAttempt(input: AttemptInput): LLMFallbackAttempt {
  return {
    provider: input.provider.name,
    model: input.provider.modelId,
    attemptNumber: input.attemptNumber,
    latencyMs: Date.now() - input.startedAt,
    errorCode: input.error instanceof LLMError ? input.error.code : 'LLM_ERROR',
    errorMessage: input.error instanceof Error ? input.error.message : String(input.error),
  };
}
