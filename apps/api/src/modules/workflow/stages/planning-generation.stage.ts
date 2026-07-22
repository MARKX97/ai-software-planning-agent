/**
 * PlanningGeneration stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.9 + `specs/model-routing.spec.md` §2.
 * Generates 11 artifacts using `callSingle` × 11 with per-artifact model routing:
 * PRD/Architecture → DeepSeek; everything else → GLM.
 *
 * @internal
 */
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { ArtifactGenerator } from '../artifact-generation/artifact-generator.js';
import { ArtifactFileStore } from '../artifact-generation/artifact-file-store.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class PlanningGenerationStage implements StageProcessor {
  readonly stage = WorkflowStage.PLANNING_GENERATION;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const store = new ArtifactFileStore(this.deps.db, this.deps.dataDir);
    const generator = new ArtifactGenerator(this.deps.orchestrator, store);
    const result = await generator.generateAll(ctx);
    for (const item of result.successes) {
      for (const call of item.calls) await this.logCall(ctx, item.provider, call);
    }
    for (const item of result.failures) {
      for (const call of item.calls) await this.logCall(ctx, item.provider, call);
    }
    if (result.successes.length === 0) throw new Error('All artifact generations failed');
    return toStageResult(this.stage, result);
  }

  private async logCall(
    ctx: WorkflowContext,
    provider: string,
    call: {
      readonly prompt: string;
      readonly response: import('@ai-planning/shared').LLMResponse | null;
      readonly error?: string;
      readonly attemptNumber: number;
    },
  ): Promise<void> {
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: this.stage,
      provider,
      promptText: call.prompt,
      response: call.response,
      error: call.error,
      attemptNumber: call.attemptNumber,
    });
  }
}

function toStageResult(
  stage: WorkflowStage,
  result: Awaited<ReturnType<ArtifactGenerator['generateAll']>>,
): StageResult {
  const generated = result.successes.map((item) => ({
    type: item.type,
    provider: item.provider,
  }));
  return {
    stage,
    structuredOutput: {
      generated,
      failed: result.failures.map((item) => ({ type: item.type, error: item.error })),
      quality_report: result.qualityReport,
    },
    content: result.successes
      .map((item) => `## ${item.type}\n${item.response.content}`)
      .join('\n\n---\n\n'),
  };
}
