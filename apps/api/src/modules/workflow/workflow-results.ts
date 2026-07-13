import { type StageResult, type WorkflowStage } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';

export async function loadPersistedStageResults(
  db: PrismaService,
  projectId: string,
): Promise<Record<WorkflowStage, StageResult>> {
  const rows = await db.client.analysisResult.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'desc' },
  });
  const results = {} as Record<WorkflowStage, StageResult>;
  for (const row of rows) {
    if (results[row.stage]) continue;
    results[row.stage] = {
      stage: row.stage,
      structuredOutput: row.content_json,
      content: row.content_text ?? JSON.stringify(row.content_json),
    };
  }
  return results;
}
