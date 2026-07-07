import type { LlmOrchestratorService } from '@ai-planning/llm-orchestrator';
import { synthesizedRequirementSchema, type LLMResponse } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { SYNTHESIS_PROMPT } from '../../../prompts/synthesis.prompt.js';
import { ConflictResolver } from './conflict-resolver.js';

export interface RequirementSynthesisResult {
  readonly provider: string;
  readonly prompt: string;
  readonly response: LLMResponse;
}

/** Synthesizes successful model analyses into one requirement document. */
export class RequirementSynthesizer {
  private readonly resolver = new ConflictResolver();

  constructor(private readonly orchestrator: LlmOrchestratorService) {}

  async synthesize(input: {
    readonly projectId: string;
    readonly originalIdea: string;
    readonly modelOutputs: Record<string, unknown>;
  }): Promise<RequirementSynthesisResult> {
    const provider = 'deepseek';
    const synthesisInput = this.resolver.resolve(input.modelOutputs);
    const prompt = renderPrompt(SYNTHESIS_PROMPT, {
      originalIdea: input.originalIdea,
      ...synthesisInput,
    });
    const response = await this.orchestrator.callSingle(provider, prompt, {
      outputSchema: synthesizedRequirementSchema,
      projectId: input.projectId,
    });
    return { provider, prompt, response };
  }
}
