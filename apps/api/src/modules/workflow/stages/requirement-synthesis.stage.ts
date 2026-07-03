/**
 * RequirementSynthesis stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.4.
 * Routes to DeepSeek via `callSingle`. Combines common/conflicts/unique-insights
 * from the three-model analysis into one SynthesizedRequirement.
 *
 * @internal
 */
import { synthesizedRequirementSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { SYNTHESIS_PROMPT } from '../../../prompts/synthesis.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class RequirementSynthesisStage implements StageProcessor {
  readonly stage = WorkflowStage.REQUIREMENT_SYNTHESIS;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const multiResult = ctx.resultsByStage[WorkflowStage.MULTI_MODEL_ANALYSIS];
    const outputs = multiResult?.structuredOutput ?? {};
    const commonPoints = JSON.stringify(outputs);
    const conflicts = '[]';
    const uniqueInsights = JSON.stringify(outputs);
    const prompt = renderPrompt(SYNTHESIS_PROMPT, {
      originalIdea: ctx.originalIdea,
      commonPoints,
      conflicts,
      uniqueInsights,
    });
    const response = await this.deps.orchestrator.callSingle('deepseek', prompt, {
      outputSchema: synthesizedRequirementSchema,
      projectId: ctx.projectId,
    });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: this.stage,
      provider: 'deepseek',
      promptText: prompt,
      response,
    });
    return {
      stage: this.stage,
      structuredOutput: response.structuredOutput,
      content: response.content,
    };
  }
}
