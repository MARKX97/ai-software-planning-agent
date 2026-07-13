/**
 * RiskAnalysis stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.6. Routes to DeepSeek via `callSingle`.
 *
 * @internal
 */
import { riskAnalysisSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { RISK_ANALYSIS_PROMPT } from '../../../prompts/risk-analysis.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class RiskAnalysisStage implements StageProcessor {
  readonly stage = WorkflowStage.RISK_ANALYSIS;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const requirement = ctx.resultsByStage[WorkflowStage.REQUIREMENT_SYNTHESIS]?.structuredOutput;
    const feasibility = ctx.resultsByStage[WorkflowStage.FEASIBILITY_ANALYSIS]?.structuredOutput;
    const prompt = renderPrompt(RISK_ANALYSIS_PROMPT, {
      requirement: requirement ? JSON.stringify(requirement) : ctx.originalIdea,
      feasibility: feasibility ? JSON.stringify(feasibility) : '(none)',
      conversationHistory: ctx.conversationHistory || '(none)',
    });
    const response = await this.deps.orchestrator.callSingle('deepseek', prompt, {
      outputSchema: riskAnalysisSchema,
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
