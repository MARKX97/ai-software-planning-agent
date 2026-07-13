/**
 * PlatformRecommendation stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.8. Routes to GLM via `callSingle`.
 *
 * @internal
 */
import { platformRecommendationSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { PLATFORM_RECOMMENDATION_PROMPT } from '../../../prompts/platform-recommendation.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class PlatformRecommendationStage implements StageProcessor {
  readonly stage = WorkflowStage.PLATFORM_RECOMMENDATION;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const requirement = ctx.resultsByStage[WorkflowStage.REQUIREMENT_SYNTHESIS]?.structuredOutput;
    const mvp = ctx.resultsByStage[WorkflowStage.MVP_COMPRESSION]?.structuredOutput;
    const prompt = renderPrompt(PLATFORM_RECOMMENDATION_PROMPT, {
      mvp: mvp ? JSON.stringify(mvp) : '(none)',
      requirement: requirement ? JSON.stringify(requirement) : ctx.originalIdea,
      conversationHistory: ctx.conversationHistory || '(none)',
    });
    const response = await this.deps.orchestrator.callSingle('glm', prompt, {
      outputSchema: platformRecommendationSchema,
      projectId: ctx.projectId,
    });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: this.stage,
      provider: 'glm',
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
