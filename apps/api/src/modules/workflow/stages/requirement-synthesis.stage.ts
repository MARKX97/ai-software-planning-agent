/**
 * RequirementSynthesis stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.4.
 * Routes to DeepSeek via `callSingle`. Combines common/conflicts/unique-insights
 * from the three-model analysis into one SynthesizedRequirement.
 *
 * @internal
 */
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { RequirementSynthesizer } from '../synthesis/requirement-synthesizer.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class RequirementSynthesisStage implements StageProcessor {
  readonly stage = WorkflowStage.REQUIREMENT_SYNTHESIS;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const multiResult = ctx.resultsByStage[WorkflowStage.MULTI_MODEL_ANALYSIS];
    const synthesizer = new RequirementSynthesizer(this.deps.orchestrator);
    const result = await synthesizer.synthesize({
      projectId: ctx.projectId,
      originalIdea: ctx.originalIdea,
      modelOutputs: (multiResult?.structuredOutput ?? {}) as Record<string, unknown>,
    });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: this.stage,
      provider: result.provider,
      promptText: result.prompt,
      response: result.response,
    });
    return {
      stage: this.stage,
      structuredOutput: result.response.structuredOutput,
      content: result.response.content,
    };
  }
}
