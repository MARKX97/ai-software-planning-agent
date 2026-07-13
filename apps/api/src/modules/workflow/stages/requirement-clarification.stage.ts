/**
 * RequirementClarification stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.2.
 * Routes to GLM via `callSingle`. Returns `{needs_more_clarification: bool}`
 * which the workflow service uses to decide whether to loop back to
 * requirement_analysis or proceed to multi_model_analysis.
 *
 * @internal
 */
import { z } from 'zod';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { CLARIFICATION_PROMPT } from '../../../prompts/clarification.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

const clarificationQuestionSchema = z.object({
  question: z.string(),
  context: z.string(),
  category: z.enum(['user', 'scope', 'tech', 'business', 'risk']),
});

const clarificationSchema = z.object({
  needs_more_clarification: z.boolean(),
  clarification_questions: z.array(clarificationQuestionSchema),
});

export interface ClarificationResult extends StageResult {
  readonly needsMoreClarification: boolean;
}

export class RequirementClarificationStage implements StageProcessor {
  readonly stage = WorkflowStage.REQUIREMENT_CLARIFICATION;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const prevAnalysis = ctx.resultsByStage[WorkflowStage.REQUIREMENT_ANALYSIS];
    const questions =
      (prevAnalysis?.structuredOutput as { clarification_questions?: string[] })
        ?.clarification_questions ?? [];
    const prompt = renderPrompt(CLARIFICATION_PROMPT, {
      questions: JSON.stringify(questions),
      conversationHistory: ctx.conversationHistory || '(none)',
      clarificationRound: String(ctx.clarificationRound),
    });
    const response = await this.deps.orchestrator.callSingle('glm', prompt, {
      outputSchema: clarificationSchema,
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
    const parsed = clarificationSchema.safeParse(response.structuredOutput);
    const needsMore = parsed.success ? parsed.data.needs_more_clarification : false;
    return {
      stage: this.stage,
      structuredOutput: parsed.success ? parsed.data : null,
      content: response.content,
      needsMoreClarification: needsMore,
    } as ClarificationResult;
  }
}
