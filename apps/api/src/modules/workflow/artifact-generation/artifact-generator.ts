import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import type { ArtifactType } from '@ai-planning/database';
import type { LLMResponse, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { PLANNING_GENERATION_PROMPT } from '../../../prompts/planning-generation.prompt.js';
import { ARTIFACT_PROVIDER, ARTIFACT_TYPES, STAGE_TIMEOUT_MS } from '../stages/model-routing.js';
import { ArtifactFileStore } from './artifact-file-store.js';
import {
  buildArtifactQualityReport,
  inspectArtifact,
  type ArtifactQualityIssueId,
} from './artifact-quality.js';

export interface ArtifactGenerationCall {
  readonly prompt: string;
  readonly response: LLMResponse | null;
  readonly error?: string;
  readonly attemptNumber: number;
}

export interface ArtifactGenerationSuccess {
  readonly type: ArtifactType;
  readonly provider: string;
  readonly prompt: string;
  readonly response: LLMResponse;
  readonly calls: readonly ArtifactGenerationCall[];
  readonly revised: boolean;
}

export interface ArtifactGenerationFailure {
  readonly type: ArtifactType;
  readonly provider: string;
  readonly prompt: string;
  readonly error: string;
  readonly calls: readonly ArtifactGenerationCall[];
  readonly qualityIssues: readonly ArtifactQualityIssueId[];
}

export interface ArtifactGenerationResult {
  readonly successes: ArtifactGenerationSuccess[];
  readonly failures: ArtifactGenerationFailure[];
  readonly qualityReport: ReturnType<typeof buildArtifactQualityReport>;
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
    return {
      successes,
      failures,
      qualityReport: buildArtifactQualityReport({
        generatedTypes: successes.map((item) => item.type),
        failures,
        revisedTypes: successes.filter((item) => item.revised).map((item) => item.type),
      }),
    };
  }

  private async generateOne(
    ctx: WorkflowContext,
    context: string,
    type: ArtifactType,
  ): Promise<ArtifactGenerationSuccess | ArtifactGenerationFailure> {
    const provider = ARTIFACT_PROVIDER[type];
    const prompt = renderPrompt(PLANNING_GENERATION_PROMPT, { context, artifactType: type });
    const calls: ArtifactGenerationCall[] = [];
    try {
      const first = await this.call({ ctx, provider, prompt, attemptNumber: 1, calls });
      const firstIssues = inspectArtifact(first.content);
      const response =
        firstIssues.length === 0
          ? first
          : await this.call({
              ctx,
              provider,
              prompt: revisionPrompt(prompt, firstIssues),
              attemptNumber: 2,
              calls,
            });
      const issues = inspectArtifact(response.content);
      if (issues.length > 0) throw new ArtifactQualityError(type, issues);
      const content = response.content.trim();
      await this.store.save({ projectId: ctx.projectId, type, content });
      return { type, provider, prompt, response, calls, revised: calls.length > 1 };
    } catch (error) {
      return {
        type,
        provider,
        prompt,
        error: this.errorMessage(error),
        calls,
        qualityIssues: error instanceof ArtifactQualityError ? error.issues : [],
      };
    }
  }

  private async call(input: {
    readonly ctx: WorkflowContext;
    readonly provider: string;
    readonly prompt: string;
    readonly attemptNumber: number;
    readonly calls: ArtifactGenerationCall[];
  }): Promise<LLMResponse> {
    const { ctx, provider, prompt, attemptNumber, calls } = input;
    try {
      const response = await this.orchestrator.callSingle(provider, prompt, {
        projectId: ctx.projectId,
        timeout: STAGE_TIMEOUT_MS.planning_generation,
      });
      calls.push({ prompt, response, attemptNumber });
      return response;
    } catch (error) {
      calls.push({ prompt, response: null, error: this.errorMessage(error), attemptNumber });
      throw error;
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
      confirmed_decisions: ctx.confirmedDecisions,
    };
    return JSON.stringify(context);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}

class ArtifactQualityError extends Error {
  constructor(
    type: ArtifactType,
    readonly issues: readonly ArtifactQualityIssueId[],
  ) {
    super(`Artifact '${type}' failed quality checks: ${issues.join(', ')}`);
  }
}

function revisionPrompt(prompt: string, issues: readonly ArtifactQualityIssueId[]): string {
  return `${prompt}\n\nREVISION_REQUIRED\nFix only these quality issues and return the complete revised artifact: ${issues.join(', ')}.`;
}
