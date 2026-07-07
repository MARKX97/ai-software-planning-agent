/**
 * RequirementAnalysis stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.1.
 * Routes to DeepSeek (single model) via `callSingle`, validates against the
 * RequirementAnalysisResult schema.
 *
 * @internal
 */
import { requirementAnalysisSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { REQUIREMENT_ANALYSIS_PROMPT } from '../../../prompts/requirement-analysis.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class RequirementAnalysisStage implements StageProcessor {
  readonly stage = WorkflowStage.REQUIREMENT_ANALYSIS;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const prompt = renderPrompt(REQUIREMENT_ANALYSIS_PROMPT, {
      idea: ctx.originalIdea,
      conversationHistory: ctx.conversationHistory || '(none)',
    });
    const response = await this.deps.orchestrator.callSingle('deepseek', prompt, {
      outputSchema: requirementAnalysisSchema,
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
