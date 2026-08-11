import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import type { ArtifactType } from '@ai-planning/database';
import type {
  ArtifactCitation,
  EvidenceCitation,
  LLMResponse,
  WorkflowContext,
} from '@ai-planning/shared';
import { ARTIFACT_PROVIDER, ARTIFACT_TYPES, STAGE_TIMEOUT_MS } from '../stages/model-routing.js';
import { ArtifactFileStore } from './artifact-file-store.js';
import { graphStageKey } from '../workflow-idempotency.js';
import { WorkflowStage } from '@ai-planning/shared';
import { finalizeArtifactContent, numberedEvidence, usedCitations } from './artifact-citations.js';
import {
  buildArtifactQualityReport,
  inspectArtifact,
  type ArtifactQualityIssueId,
} from './artifact-quality.js';
import { ArtifactQualityError, artifactPrompt, revisionPrompt } from './artifact-prompt.js';

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
  readonly content: string;
  readonly citations: readonly ArtifactCitation[];
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

  async generateAll(
    ctx: WorkflowContext,
    evidence: readonly EvidenceCitation[] = [],
    targetTypes: readonly ArtifactType[] = ARTIFACT_TYPES,
  ): Promise<ArtifactGenerationResult> {
    const context = this.buildContextJson(ctx);
    const results = await Promise.all(
      targetTypes.map((type) =>
        this.generateOne(ctx, context, { type, evidence: numberedEvidence(type, evidence) }),
      ),
    );
    const successes = results.filter((r): r is ArtifactGenerationSuccess => 'response' in r);
    const failures = results.filter((r): r is ArtifactGenerationFailure => 'error' in r);
    const failedTypes = new Set(failures.map((item) => item.type));
    const generatedTypes = (await this.store.activeTypes(ctx.projectId)).filter(
      (type) => !failedTypes.has(type),
    );
    return {
      successes,
      failures,
      qualityReport: buildArtifactQualityReport({
        generatedTypes,
        failures,
        revisedTypes: successes.filter((item) => item.revised).map((item) => item.type),
      }),
    };
  }

  private async generateOne(
    ctx: WorkflowContext,
    context: string,
    target: { type: ArtifactType; evidence: readonly ArtifactCitation[] },
  ): Promise<ArtifactGenerationSuccess | ArtifactGenerationFailure> {
    const { type, evidence } = target;
    const provider = ARTIFACT_PROVIDER[type];
    const prompt = artifactPrompt(context, type, evidence);
    const calls: ArtifactGenerationCall[] = [];
    const citationKeys = evidence.map((item) => item.citationKey);
    try {
      const response = await this.generateResponse({ ctx, provider, prompt, calls, citationKeys });
      const issues = inspectArtifact(response.content, citationKeys);
      if (issues.length > 0) throw new ArtifactQualityError(type, issues);
      const content = finalizeArtifactContent(response.content, evidence.length > 0);
      const citations = usedCitations(content, evidence);
      await this.store.save({
        projectId: ctx.projectId,
        type,
        content,
        citations,
        idempotencyKey: graphStageKey(ctx, WorkflowStage.PLANNING_GENERATION, type),
      });
      return {
        type,
        provider,
        prompt,
        response,
        calls,
        revised: calls.length > 1,
        content,
        citations,
      };
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

  private async generateResponse(input: {
    readonly ctx: WorkflowContext;
    readonly provider: string;
    readonly prompt: string;
    readonly calls: ArtifactGenerationCall[];
    readonly citationKeys: readonly string[];
  }): Promise<LLMResponse> {
    const { ctx, provider, prompt, calls, citationKeys } = input;
    const first = await this.call({ ctx, provider, prompt, attemptNumber: 1, calls });
    const issues = inspectArtifact(first.content, citationKeys);
    if (issues.length === 0) return first;
    return this.call({
      ctx,
      provider,
      prompt: revisionPrompt(prompt, issues),
      attemptNumber: 2,
      calls,
    });
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
      agent_evidence: ctx.agentContext,
    };
    return JSON.stringify(context);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
