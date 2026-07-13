import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import type { ArtifactType } from '@ai-planning/database';
import type { LLMResponse, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { PLANNING_GENERATION_PROMPT } from '../../../prompts/planning-generation.prompt.js';
import { ARTIFACT_PROVIDER, ARTIFACT_TYPES } from '../stages/model-routing.js';
import { ArtifactFileStore } from './artifact-file-store.js';

export interface ArtifactGenerationSuccess {
  readonly type: ArtifactType;
  readonly provider: string;
  readonly prompt: string;
  readonly response: LLMResponse;
}

export interface ArtifactGenerationFailure {
  readonly type: ArtifactType;
  readonly provider: string;
  readonly prompt: string;
  readonly error: string;
}

export interface ArtifactGenerationResult {
  readonly successes: ArtifactGenerationSuccess[];
  readonly failures: ArtifactGenerationFailure[];
}

/** Generates all planning artifacts with per-artifact model routing. */
export class ArtifactGenerator {
  constructor(
    private readonly orchestrator: LlmOrchestratorService,
    private readonly store: ArtifactFileStore,
  ) {}

  async generateAll(ctx: WorkflowContext): Promise<ArtifactGenerationResult> {
    const context = this.buildContextJson(ctx);
    const results = await Promise.all(
      ARTIFACT_TYPES.map((type) => this.generateOne(ctx, context, type)),
    );
    const successes = results.filter((r): r is ArtifactGenerationSuccess => 'response' in r);
    const failures = results.filter((r): r is ArtifactGenerationFailure => 'error' in r);
    if (successes.length === 0) throw new Error('All artifact generations failed');
    return { successes, failures };
  }

  private async generateOne(
    ctx: WorkflowContext,
    context: string,
    type: ArtifactType,
  ): Promise<ArtifactGenerationSuccess | ArtifactGenerationFailure> {
    const provider = ARTIFACT_PROVIDER[type];
    const prompt = renderPrompt(PLANNING_GENERATION_PROMPT, { context, artifactType: type });
    try {
      const response = await this.orchestrator.callSingle(provider, prompt, {
        projectId: ctx.projectId,
      });
      const content = response.content.trim();
      if (!content) throw new Error(`Artifact '${type}' content is empty`);
      await this.store.save({ projectId: ctx.projectId, type, content });
      return { type, provider, prompt, response };
    } catch (error) {
      return { type, provider, prompt, error: this.errorMessage(error) };
    }
  }

  private buildContextJson(ctx: WorkflowContext): string {
    const context = {
      original_idea: ctx.originalIdea,
      requirement: ctx.resultsByStage.requirement_synthesis?.structuredOutput,
      feasibility: ctx.resultsByStage.feasibility_analysis?.structuredOutput,
      risks: ctx.resultsByStage.risk_analysis?.structuredOutput,
      mvp: ctx.resultsByStage.mvp_compression?.structuredOutput,
      platform: ctx.resultsByStage.platform_recommendation?.structuredOutput,
      confirmed_discussions: ctx.conversationHistory,
    };
    return JSON.stringify(context);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
