/**
 * Persists a stage's structured output to the `analysis_results` table.
 *
 * Source: `specs/state-machine.spec.md` §7 `on_exit_stage` event.
 *
 * @internal
 */
import type { WorkflowStage } from '@ai-planning/shared';
import type { StageResult } from '@ai-planning/shared';
import type { PrismaService } from '../../../database/database.module.js';
import { graphStageKey } from '../workflow-idempotency.js';

/** Persist a single stage's structured output to the analysis_results table. */
interface PersistAnalysisResultInput {
  readonly db: PrismaService;
  readonly projectId: string;
  readonly executionId: string;
  readonly stage: WorkflowStage;
  readonly result: StageResult;
  readonly graphRunId?: string;
  readonly logicalAttempt?: number;
}

export async function persistAnalysisResult(input: PersistAnalysisResultInput): Promise<void> {
  const { db, projectId, executionId, stage, result } = input;
  const resultType = result.byProvider
    ? 'multi_model'
    : result.structuredOutput !== null
      ? 'structured'
      : 'free_text';
  const idempotencyKey = graphStageKey(input, stage, 'result');
  const data = {
    project_id: projectId,
    execution_id: executionId,
    stage,
    result_type: resultType,
    content_json: (result.structuredOutput ?? { content: result.content }) as never,
    content_text: result.content,
    result_json: result as never,
    idempotency_key: idempotencyKey,
  };
  if (!idempotencyKey) {
    await db.client.analysisResult.create({ data });
    return;
  }
  await db.client.analysisResult.upsert({
    where: { idempotency_key: idempotencyKey },
    create: data,
    update: {},
  });
}

export async function loadIdempotentStageResult(
  input: Omit<PersistAnalysisResultInput, 'executionId' | 'projectId' | 'result'>,
): Promise<StageResult | null> {
  const idempotencyKey = graphStageKey(input, input.stage, 'result');
  if (!idempotencyKey) return null;
  const row = await input.db.client.analysisResult.findUnique({
    where: { idempotency_key: idempotencyKey },
    select: { result_json: true },
  });
  return row?.result_json ? (row.result_json as unknown as StageResult) : null;
}
