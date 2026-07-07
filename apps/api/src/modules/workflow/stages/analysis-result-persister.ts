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

/** Persist a single stage's structured output to the analysis_results table. */
export async function persistAnalysisResult(
  db: PrismaService,
  projectId: string,
  executionId: string,
  stage: WorkflowStage,
  result: StageResult,
): Promise<void> {
  const resultType = result.byProvider
    ? 'multi_model'
    : result.structuredOutput !== null
      ? 'structured'
      : 'free_text';
  await db.client.analysisResult.create({
    data: {
      project_id: projectId,
      execution_id: executionId,
      stage,
      result_type: resultType,
      content_json: (result.structuredOutput ?? { content: result.content }) as never,
      content_text: result.content,
    },
  });
}
