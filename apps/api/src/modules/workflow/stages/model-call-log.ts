/**
 * Model call logger — persists each orchestrator call result to the
 * `model_execution_logs` table for cost accounting and audit.
 *
 * Source: `specs/state-machine.spec.md` §7 `on_exit_stage` events.
 *
 * @internal
 */
import type { LLMResponse } from '@ai-planning/shared';
import type { WorkflowStage } from '@ai-planning/shared';
import { CallStatus } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';

export interface ModelCallLogEntry {
  readonly projectId: string;
  readonly executionId: string;
  readonly stage: WorkflowStage;
  readonly provider: string;
  readonly promptText: string;
  readonly response: LLMResponse | null;
  readonly error?: string;
}

/** Persist a single model call (success or failure) to the execution log. */
export async function logModelCall(db: PrismaService, entry: ModelCallLogEntry): Promise<void> {
  const status = entry.response ? CallStatus.SUCCESS : CallStatus.FAILED;
  const provider = entry.provider as 'deepseek' | 'glm' | 'minimax';
  await db.client.modelExecutionLog.create({
    data: {
      project_id: entry.projectId,
      execution_id: entry.executionId,
      stage: entry.stage,
      provider_name: provider,
      model_id: entry.response?.model ?? entry.provider,
      status,
      attempt_number: entry.response?.retries ?? 0,
      prompt_text: entry.promptText,
      response_text: entry.response?.content ?? null,
      structured_output: (entry.response?.structuredOutput ?? null) as never,
      input_tokens: entry.response?.usage.inputTokens ?? 0,
      output_tokens: entry.response?.usage.outputTokens ?? 0,
      latency_ms: entry.response?.latencyMs ?? null,
      error_message: entry.error ?? null,
    },
  });
}
