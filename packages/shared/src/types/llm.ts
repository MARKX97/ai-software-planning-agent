import { z } from 'zod';

/**
 * LLM core type definitions shared across llm-core / llm-providers /
 * llm-orchestrator. Defined here per AGENTS.md §1.4 so the three packages do
 * not need to depend on one another merely to share types.
 *
 * Source: specs/provider.spec.md §6-7 + specs/orchestrator.spec.md §1.
 * @internal
 */

/** Logical provider name. Matches the `LLMProvider` enum in the Prisma schema. */
export type LLMProviderName = 'deepseek' | 'glm' | 'minimax';

/** Per-model pricing in CNY per 1K tokens. */
export interface ModelPricing {
  /** Input price per 1K tokens (CNY). */
  readonly inputPer1k: number;
  /** Output price per 1K tokens (CNY). */
  readonly outputPer1k: number;
}

/** Token usage reported by the provider. */
export interface TokenUsage {
  /** Prompt tokens consumed. */
  readonly inputTokens: number;
  /** Completion tokens produced. */
  readonly outputTokens: number;
  /** Total tokens (input + output). */
  readonly totalTokens: number;
}

/** Cost breakdown for a single call. */
export interface CostInfo {
  /** Input token cost (CNY). */
  readonly inputCost: number;
  /** Output token cost (CNY). */
  readonly outputCost: number;
  /** Total cost (CNY). */
  readonly totalCost: number;
}

/** OpenAI-compatible chat completion request body. */
export interface LLMRequest {
  /** Model ID sent to the gateway. */
  readonly model: string;
  /** Prompt text or messages array. */
  readonly messages: ReadonlyArray<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  /** Sampling temperature (default 0.7). */
  readonly temperature?: number;
  /** Max output tokens (default 4096). */
  readonly maxTokens?: number;
}

/** Options passed to `provider.chat()` / orchestrator calls. */
export interface LLMCallOptions {
  /**
   * Optional zod schema constraining structured output. When provided the
   * orchestrator parses the model's JSON response and validates it against
   * this schema; failures degrade to `structuredOutput = null` rather than
   * throwing (per specs/provider.spec.md §2).
   */
  readonly outputSchema?: z.ZodSchema;
  /** Sampling temperature (default 0.7). */
  readonly temperature?: number;
  /** Max output tokens (default 4096). */
  readonly maxTokens?: number;
  /** Per-call timeout in milliseconds (default 60000). */
  readonly timeout?: number;
  /**
   * Optional project id used by CostController for per-project budget checks.
   */
  readonly projectId?: string;
}

/** Options for a streamed single-model call. */
export interface LLMStreamOptions extends LLMCallOptions {
  /** Receives each text delta in provider order. */
  readonly onDelta: (content: string) => void | Promise<void>;
  /** Cancels the upstream request when the client disconnects. */
  readonly signal?: AbortSignal;
}

/** Normalized response from a single model invocation. */
export interface LLMResponse {
  /** Provider logical name. */
  readonly provider: string;
  /** Model ID. */
  readonly model: string;
  /** Raw text content returned by the model. */
  readonly content: string;
  /** Schema-validated structured output, or `null` when validation failed. */
  readonly structuredOutput: unknown;
  /** Token usage. */
  readonly usage: TokenUsage;
  /** Cost breakdown. */
  readonly cost: CostInfo;
  /** Call latency in milliseconds. */
  readonly latencyMs: number;
  /** Number of retries performed (0 = first attempt succeeded). */
  readonly retries: number;
  /** ISO-8601 timestamp of the call. */
  readonly timestamp: string;
}
