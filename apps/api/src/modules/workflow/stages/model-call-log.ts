/**
 * Model call logger — persists each orchestrator call result to the
 * `model_execution_logs` table for cost accounting and audit.
 *
 * Source: `specs/state-machine.spec.md` §7 `on_exit_stage` events.
 *
 * @internal
 */
import type { Prisma } from '@ai-planning/database';
import type { LLMResponse } from '@ai-planning/shared';
import type { WorkflowStage } from '@ai-planning/shared';
import { CallStatus } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { redactSensitiveText } from '../../../common/security/sensitive-text.js';
import { isUniqueViolation, modelCallKey } from '../workflow-idempotency.js';
import { createHash } from 'node:crypto';

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
  readonly promptName?: string;
}

interface ModelCallContext {
  readonly status: CallStatus;
  readonly provider: 'deepseek' | 'glm' | 'minimax';
  readonly promptVersionId: string | null;
  readonly idempotencyKey?: string;
}

/** Persist a single model call (success or failure) to the execution log. */
export async function logModelCall(db: PrismaService, entry: ModelCallLogEntry): Promise<void> {
  const context = await resolveModelCallContext(db, entry);
  try {
    await db.client.$transaction(async (tx) => {
      await createModelExecutionLog(tx, entry, context);
      await updateTokenUsage(tx, entry, new Date());
    });
  } catch (error) {
    if (context.idempotencyKey && isUniqueViolation(error)) return;
    throw error;
  }
}

async function resolveModelCallContext(
  db: PrismaService,
  entry: ModelCallLogEntry,
): Promise<ModelCallContext> {
  const promptVersion = await db.client.promptVersion?.findFirst({
    where: { prompt_name: entry.promptName ?? entry.stage },
    orderBy: { created_at: 'desc' },
    select: { id: true },
  });
  const graphRun = await db.client.graphRun?.findFirst({
    where: { execution_id: entry.executionId },
    orderBy: { updated_at: 'desc' },
    select: { id: true, logical_attempt: true },
  });
  return {
    status: callStatus(entry),
    provider: entry.provider as ModelCallContext['provider'],
    promptVersionId: promptVersion?.id ?? null,
    idempotencyKey: graphRun
      ? modelCallKey({
          graphRunId: graphRun.id,
          logicalAttempt: graphRun.logical_attempt,
          stage: entry.stage,
          provider: entry.provider,
          attemptNumber: entry.attemptNumber ?? 1,
          prompt: entry.promptText,
        })
      : undefined,
  };
}

async function createModelExecutionLog(
  tx: Prisma.TransactionClient,
  entry: ModelCallLogEntry,
  context: ModelCallContext,
): Promise<void> {
  const usage = entry.response?.usage;
  const cost = entry.response?.cost;
  await tx.modelExecutionLog.create({
    data: {
      project_id: entry.projectId,
      execution_id: entry.executionId,
      stage: entry.stage,
      provider_name: context.provider,
      model_id: entry.response?.model ?? entry.modelId ?? entry.provider,
      status: context.status,
      attempt_number: entry.attemptNumber ?? 1,
      prompt_version_id: context.promptVersionId,
      prompt_hash: createHash('sha256').update(entry.promptText).digest('hex'),
      prompt_length: entry.promptText.length,
      response_length: entry.response?.content.length ?? null,
      response_summary: entry.response ? '模型调用成功，响应内容已按隐私策略省略。' : null,
      input_tokens: usage?.inputTokens ?? 0,
      output_tokens: usage?.outputTokens ?? 0,
      cached_tokens: usage?.cachedTokens ?? 0,
      cost_input: cost?.inputCost ?? 0,
      cost_output: cost?.outputCost ?? 0,
      cost_cached: cost?.cachedInputCost ?? 0,
      cost_total: cost?.totalCost ?? 0,
      latency_ms: entry.response?.latencyMs ?? entry.latencyMs ?? null,
      error_code: entry.response ? null : (entry.errorCode ?? context.status.toUpperCase()),
      error_message: entry.error ? redactSensitiveText(entry.error) : null,
      idempotency_key: context.idempotencyKey,
    },
  });
}

async function updateTokenUsage(
  tx: Prisma.TransactionClient,
  entry: ModelCallLogEntry,
  now: Date,
): Promise<void> {
  const status = callStatus(entry);
  const usage = entry.response?.usage;
  const cost = entry.response?.cost;
  const latency = await tx.modelExecutionLog.aggregate({
    where: { project_id: entry.projectId, latency_ms: { not: null } },
    _avg: { latency_ms: true },
  });
  const averageLatency = latency._avg.latency_ms;
  const avgLatencyMs = averageLatency === null ? null : Math.round(averageLatency);
  await tx.tokenUsage.upsert({
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
