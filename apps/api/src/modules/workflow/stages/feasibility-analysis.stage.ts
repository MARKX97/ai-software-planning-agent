/**
 * FeasibilityAnalysis stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.5. Routes to GLM via `callSingle`.
 *
 * @internal
 */
import { feasibilityAssessmentSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { FEASIBILITY_ANALYSIS_PROMPT } from '../../../prompts/feasibility-analysis.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class FeasibilityAnalysisStage implements StageProcessor {
  readonly stage = WorkflowStage.FEASIBILITY_ANALYSIS;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const requirement = ctx.resultsByStage[WorkflowStage.REQUIREMENT_SYNTHESIS]?.structuredOutput;
    const prompt = renderPrompt(FEASIBILITY_ANALYSIS_PROMPT, {
      requirement: requirement ? JSON.stringify(requirement) : ctx.originalIdea,
      conversationHistory: ctx.conversationHistory || '(none)',
    });
    const response = await this.deps.orchestrator.callSingle('glm', prompt, {
      outputSchema: feasibilityAssessmentSchema,
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
