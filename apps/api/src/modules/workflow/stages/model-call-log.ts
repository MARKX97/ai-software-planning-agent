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
import { redactSensitiveText } from '../../../common/security/sensitive-text.js';

export interface ModelCallLogEntry {
  readonly projectId: string;
  readonly executionId: string;
  readonly stage: WorkflowStage;
  readonly provider: string;
  readonly promptText: string;
  readonly response: LLMResponse | null;
  readonly error?: string;
  readonly errorCode?: string;
  readonly latencyMs?: number;
  readonly modelId?: string;
  readonly attemptNumber?: number;
}

/** Persist a single model call (success or failure) to the execution log. */
export async function logModelCall(db: PrismaService, entry: ModelCallLogEntry): Promise<void> {
  const status = callStatus(entry);
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
      model_id: entry.response?.model ?? entry.modelId ?? entry.provider,
      status,
      attempt_number: entry.attemptNumber ?? 1,
      prompt_text: redactSensitiveText(entry.promptText),
      response_text: entry.response ? redactSensitiveText(entry.response.content) : null,
      structured_output: (entry.response?.structuredOutput ?? null) as never,
      input_tokens: usage?.inputTokens ?? 0,
      output_tokens: usage?.outputTokens ?? 0,
      cached_tokens: usage?.cachedTokens ?? 0,
      cost_input: cost?.inputCost ?? 0,
      cost_output: cost?.outputCost ?? 0,
      cost_cached: cost?.cachedInputCost ?? 0,
      cost_total: cost?.totalCost ?? 0,
      latency_ms: entry.response?.latencyMs ?? entry.latencyMs ?? null,
      error_code: entry.response ? null : (entry.errorCode ?? status.toUpperCase()),
      error_message: entry.error ? redactSensitiveText(entry.error) : null,
    },
  });
  await updateTokenUsage(db, entry, now);
}

async function updateTokenUsage(
  db: PrismaService,
  entry: ModelCallLogEntry,
  now: Date,
): Promise<void> {
  const status = callStatus(entry);
  const usage = entry.response?.usage;
  const cost = entry.response?.cost;
  const latency = await db.client.modelExecutionLog.aggregate({
    where: { project_id: entry.projectId, latency_ms: { not: null } },
    _avg: { latency_ms: true },
  });
  const averageLatency = latency._avg.latency_ms;
  const avgLatencyMs = averageLatency === null ? null : Math.round(averageLatency);
  await db.client.tokenUsage.upsert({
    where: { project_id: entry.projectId },
    create: {
      project_id: entry.projectId,
      total_input_tokens: usage?.inputTokens ?? 0,
      total_output_tokens: usage?.outputTokens ?? 0,
      total_cached_tokens: usage?.cachedTokens ?? 0,
      total_tokens: usage?.totalTokens ?? 0,
      total_cost: cost?.totalCost ?? 0,
      call_count: 1,
      success_count: status === CallStatus.SUCCESS ? 1 : 0,
      failed_count: status === CallStatus.FAILED ? 1 : 0,
      timeout_count: status === CallStatus.TIMEOUT ? 1 : 0,
      rate_limited_count: status === CallStatus.RATE_LIMITED ? 1 : 0,
      avg_latency_ms: avgLatencyMs,
      updated_at: now,
    },
    update: {
      total_input_tokens: { increment: usage?.inputTokens ?? 0 },
      total_output_tokens: { increment: usage?.outputTokens ?? 0 },
      total_cached_tokens: { increment: usage?.cachedTokens ?? 0 },
      total_tokens: { increment: usage?.totalTokens ?? 0 },
      total_cost: { increment: cost?.totalCost ?? 0 },
      call_count: { increment: 1 },
      success_count: { increment: status === CallStatus.SUCCESS ? 1 : 0 },
      failed_count: { increment: status === CallStatus.FAILED ? 1 : 0 },
      timeout_count: { increment: status === CallStatus.TIMEOUT ? 1 : 0 },
      rate_limited_count: { increment: status === CallStatus.RATE_LIMITED ? 1 : 0 },
      avg_latency_ms: avgLatencyMs,
      updated_at: now,
    },
  });
}

function callStatus(entry: ModelCallLogEntry): CallStatus {
  if (entry.response) return CallStatus.SUCCESS;
  const signal = `${entry.errorCode ?? ''} ${entry.error ?? ''}`;
  if (/timeout|timed out|aborted/i.test(signal)) return CallStatus.TIMEOUT;
  if (/rate.?limit|too many requests|429/i.test(signal)) {
    return CallStatus.RATE_LIMITED;
  }
  return CallStatus.FAILED;
}
