/**
 * PlanningGeneration stage processor.
 *
 * Source: `specs/workflow.spec.md` §4.9 + `specs/model-routing.spec.md` §2.
 * Generates 11 artifacts using `callSingle` × 11 with per-artifact model routing:
 * PRD/Architecture → DeepSeek; everything else → GLM.
 *
 * @internal
 */
import { WorkflowStage } from '@ai-planning/shared';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { PLANNING_GENERATION_PROMPT } from '../../../prompts/planning-generation.prompt.js';
import type { StageDeps } from './stage-deps.js';
import type { StageProcessor } from './stage-processor.js';
import { logModelCall } from './model-call-log.js';
import { ARTIFACT_DISPLAY_NAME, ARTIFACT_PROVIDER, ARTIFACT_TYPES } from './model-routing.js';

export interface GeneratedArtifact {
  readonly type: string;
  readonly provider: string;
  readonly content: string;
}

export class PlanningGenerationStage implements StageProcessor {
  readonly stage = WorkflowStage.PLANNING_GENERATION;

  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext): Promise<StageResult> {
    const context = this.buildContextJson(ctx);
    const artifacts = await Promise.all(
      ARTIFACT_TYPES.map((artifactType) => this.generateArtifact(ctx, context, artifactType)),
    );
    return {
      stage: this.stage,
      structuredOutput: artifacts.map((a) => ({ type: a.type, provider: a.provider })),
      content: artifacts.map((a) => `## ${a.type}\n${a.content}`).join('\n\n---\n\n'),
    };
  }

  private async generateArtifact(
    ctx: WorkflowContext,
    context: string,
    artifactType: string,
  ): Promise<GeneratedArtifact> {
    const provider = ARTIFACT_PROVIDER[artifactType];
    const prompt = renderPrompt(PLANNING_GENERATION_PROMPT, { context, artifactType });
    const response = await this.deps.orchestrator.callSingle(provider, prompt, {
      projectId: ctx.projectId,
    });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: this.stage,
      provider,
      promptText: prompt,
      response,
    });
    await this.deps.db.client.artifact.create({
      data: {
        project_id: ctx.projectId,
        type: artifactType as never,
        type_display_name: ARTIFACT_DISPLAY_NAME[artifactType],
        title: ARTIFACT_DISPLAY_NAME[artifactType],
        stage: this.stage,
        content: response.content,
        updated_at: new Date(),
      },
    });
    return { type: artifactType, provider, content: response.content };
  }

  private buildContextJson(ctx: WorkflowContext): string {
    const result = ctx.resultsByStage[WorkflowStage.REQUIREMENT_SYNTHESIS]?.structuredOutput;
    return JSON.stringify(result ?? { original_idea: ctx.originalIdea });
  }
}
