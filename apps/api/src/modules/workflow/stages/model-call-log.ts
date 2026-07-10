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
  const usage = entry.response?.usage;
  const cost = entry.response?.cost;
  const now = new Date();
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
      input_tokens: usage?.inputTokens ?? 0,
      output_tokens: usage?.outputTokens ?? 0,
      cost_input: cost?.inputCost ?? 0,
      cost_output: cost?.outputCost ?? 0,
      cost_total: cost?.totalCost ?? 0,
      latency_ms: entry.response?.latencyMs ?? null,
      error_message: entry.error ?? null,
    },
  });
  await db.client.tokenUsage.upsert({
    where: { project_id: entry.projectId },
    create: {
      project_id: entry.projectId,
      total_input_tokens: usage?.inputTokens ?? 0,
      total_output_tokens: usage?.outputTokens ?? 0,
      total_tokens: usage?.totalTokens ?? 0,
      total_cost: cost?.totalCost ?? 0,
      call_count: 1,
      success_count: entry.response ? 1 : 0,
      failed_count: entry.response ? 0 : 1,
      timeout_count: 0,
      rate_limited_count: 0,
      avg_latency_ms: entry.response?.latencyMs ?? null,
      updated_at: now,
    },
    update: {
      total_input_tokens: { increment: usage?.inputTokens ?? 0 },
      total_output_tokens: { increment: usage?.outputTokens ?? 0 },
      total_tokens: { increment: usage?.totalTokens ?? 0 },
      total_cost: { increment: cost?.totalCost ?? 0 },
      call_count: { increment: 1 },
      success_count: { increment: entry.response ? 1 : 0 },
      failed_count: { increment: entry.response ? 0 : 1 },
      avg_latency_ms: entry.response?.latencyMs ?? null,
      updated_at: now,
    },
  });
}
