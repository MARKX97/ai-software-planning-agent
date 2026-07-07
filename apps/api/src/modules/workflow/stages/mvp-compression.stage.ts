/**
 * MVPCompression stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.7. Routes to DeepSeek via `callSingle`.
 *
 * @internal
 */
import { mvpPlanSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { MVP_COMPRESSION_PROMPT } from '../../../prompts/mvp-compression.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export class MvpCompressionStage implements StageProcessor {
  readonly stage = WorkflowStage.MVP_COMPRESSION;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const requirement = ctx.resultsByStage[WorkflowStage.REQUIREMENT_SYNTHESIS]?.structuredOutput;
    const risks = ctx.resultsByStage[WorkflowStage.RISK_ANALYSIS]?.structuredOutput;
    const feasibility = ctx.resultsByStage[WorkflowStage.FEASIBILITY_ANALYSIS]?.structuredOutput;
    const prompt = renderPrompt(MVP_COMPRESSION_PROMPT, {
      requirement: requirement ? JSON.stringify(requirement) : ctx.originalIdea,
      risks: risks ? JSON.stringify(risks) : '(none)',
      feasibility: feasibility ? JSON.stringify(feasibility) : '(none)',
    });
    const response = await this.deps.orchestrator.callSingle('deepseek', prompt, {
      outputSchema: mvpPlanSchema,
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
