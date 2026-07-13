/**
 * RequirementClarification stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.2.
 * Routes to GLM via the orchestrator. Returns `{needs_more_clarification: bool}`
 * which the workflow service uses to decide whether to loop back to
 * requirement_analysis or proceed to multi_model_analysis.
 *
 * @internal
 */
import { MAX_CLARIFICATION_ROUNDS, WorkflowStage } from '@ai-planning/shared';
import type { RequirementAnalysisResult, StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { CLARIFICATION_PROMPT } from '../../../prompts/clarification.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export interface ClarificationResult extends StageResult {
  readonly needsMoreClarification: boolean;
}

export class RequirementClarificationStage implements StageProcessor {
  readonly stage = WorkflowStage.REQUIREMENT_CLARIFICATION;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const prevAnalysis = ctx.resultsByStage[WorkflowStage.REQUIREMENT_ANALYSIS];
    const questions =
      (prevAnalysis?.structuredOutput as RequirementAnalysisResult | undefined)
        ?.clarification_questions ?? [];
    const prompt = renderPrompt(CLARIFICATION_PROMPT, {
      questions: JSON.stringify(questions),
      conversationHistory: ctx.conversationHistory || '(none)',
      clarificationRound: String(ctx.clarificationRound),
    });
    const stream = this.deps.stream;
    const response = stream
      ? await this.deps.orchestrator.callSingleStream('glm', prompt, {
          projectId: ctx.projectId,
          ...stream,
        })
      : await this.deps.orchestrator.callSingle('glm', prompt, { projectId: ctx.projectId });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: this.stage,
      provider: 'glm',
      promptText: prompt,
      response,
    });
    const needsMore = questions.length > 0 && ctx.clarificationRound < MAX_CLARIFICATION_ROUNDS;
    return {
      stage: this.stage,
      structuredOutput: {
        needs_more_clarification: needsMore,
        clarification_questions: needsMore ? questions : [],
      },
      content: response.content,
      needsMoreClarification: needsMore,
    } as ClarificationResult;
  }
}
