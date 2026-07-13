/**
 * Workflow domain types — pure data shapes exchanged between the workflow
 * service and individual stage processors. Kept free of any NestJS / Prisma
 * coupling so they can be reused across the API layer.
 *
 * @internal
 */
import type { WorkflowStage } from '../enums/workflow-stage.js';
import type { LLMResponse } from './llm.js';

/** Per-stage structured-output payload produced by the orchestrator. */
export interface StageResult {
  /** Stage that produced this result. */
  readonly stage: WorkflowStage;
  /** Schema-validated structured output, or `null` on validation failure. */
  readonly structuredOutput: unknown;
  /** Raw text content returned by the model. */
  readonly content: string;
  /** Optional downstream artifacts keyed by provider name (multi-model stage). */
  readonly byProvider?: Record<string, LLMResponse | null>;
}

/** Per-project context threaded through every stage processor. */
export interface WorkflowContext {
  readonly projectId: string;
  readonly executionId: string;
  readonly originalIdea: string;
  readonly conversationHistory: string;
  clarificationRound: number;
  readonly resultsByStage: Record<WorkflowStage, StageResult>;
}

/** Maximum number of clarification rounds before forcing progression. */
export const MAX_CLARIFICATION_ROUNDS = 5;

export interface WorkflowStreamError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/** Wire-level SSE event shared by API producers and stream consumers. */
export type WorkflowStreamEvent<TMessage = unknown, TStatus = unknown> =
  | { readonly event: 'delta'; readonly data: { readonly content: string } }
  | {
      readonly event: 'done';
      readonly data: { readonly assistant_message: TMessage; readonly status: TStatus };
    }
  | {
      readonly event: 'error';
      readonly data: { readonly error: WorkflowStreamError; readonly retryable: boolean };
    };
