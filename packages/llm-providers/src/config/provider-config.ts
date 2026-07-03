import type { LLMProviderName } from '@ai-planning/shared';

/**
 * Provider configuration consumed by {@link BaseProvider} and its subclasses.
 *
 * @internal
 */
export interface ProviderConfig {
  /** Logical name (matches `LLMProvider` enum). */
  readonly name: LLMProviderName;
  /** Model ID sent to the gateway. */
  readonly modelId: string;
  /** Display name shown in `/models`. */
  readonly displayName: string;
  /** Pricing (CNY per 1K tokens). */
  readonly pricing: { inputPer1k: number; outputPer1k: number };
  /** Maximum output tokens advertised by the model. */
  readonly maxTokens: number;
  /** Advertised capabilities. */
  readonly capabilities: string[];
  /** Human-readable description. */
  readonly description: string;
}

/** Default timeout per call (ms). Matches spec §3. */
export const DEFAULT_TIMEOUT_MS = 60000;
