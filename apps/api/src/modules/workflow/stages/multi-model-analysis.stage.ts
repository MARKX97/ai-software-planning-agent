/**
 * MultiModelAnalysis stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.3.
 * Calls all 3 providers in parallel via `callMulti`. Degradation policy:
 *   3/3 success → normal; 2/3 → warning; 1/3 → severe degradation; 0/3 → FAILED.
 *
 * @internal
 */
import { multiModelAnalysisSchema } from '@ai-planning/shared';
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext, LLMResponse } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { MULTI_MODEL_ANALYSIS_PROMPT } from '../../../prompts/multi-model-analysis.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';

export interface MultiModelResult extends StageResult {
  readonly byProvider: Record<string, LLMResponse | null>;
  readonly successCount: number;
}

export class MultiModelAnalysisStage implements StageProcessor {
  readonly stage = WorkflowStage.MULTI_MODEL_ANALYSIS;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const analysis = ctx.resultsByStage[WorkflowStage.REQUIREMENT_ANALYSIS]?.structuredOutput;
    const requirementText = analysis ? JSON.stringify(analysis) : ctx.originalIdea;
    const prompt = renderPrompt(MULTI_MODEL_ANALYSIS_PROMPT, {
      requirement: requirementText,
    });
    const byProvider = await this.deps.orchestrator.callMulti(prompt, {
      outputSchema: multiModelAnalysisSchema,
      projectId: ctx.projectId,
    });
    const entries = Object.entries(byProvider);
    const successCount = entries.filter(([, r]) => r !== null).length;
    for (const [provider, response] of entries) {
      await logModelCall(this.deps.db, {
        projectId: ctx.projectId,
        executionId: ctx.executionId,
        stage: this.stage,
        provider,
        promptText: prompt,
        response,
        error: response ? undefined : 'model failed',
      });
    }
    const mergedResults = entries
      .filter(([, r]) => r !== null)
      .map(([name, r]) => ({ [name]: r?.structuredOutput }));
    return {
      stage: this.stage,
      structuredOutput: Object.assign({}, ...mergedResults),
      content: entries.map(([n, r]) => `${n}: ${r?.content ?? 'failed'}`).join('\n\n'),
      byProvider,
      successCount,
    } as MultiModelResult;
  }
}
