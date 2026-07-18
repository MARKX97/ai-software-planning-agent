import type { LLMResponse, WorkflowContext, WorkflowStage } from '@ai-planning/shared';
import type { StageDeps } from './stage-deps.js';
import { DIALOGUE_PROVIDER_ORDER } from './model-routing.js';
import { logModelCall } from './model-call-log.js';

export interface DialogueCallInput {
  readonly deps: StageDeps;
  readonly ctx: WorkflowContext;
  readonly stage: WorkflowStage;
  readonly prompt: string;
}

/** Call the dialogue model and persist every Provider dispatch in order. */
export async function callDialogueModel(input: DialogueCallInput): Promise<LLMResponse> {
  let successAttempt = 1;
  const response = input.deps.stream
    ? await input.deps.orchestrator.callSingleStreamWithFallback(
        [...DIALOGUE_PROVIDER_ORDER],
        input.prompt,
        {
          projectId: input.ctx.projectId,
          ...input.deps.stream,
          onProviderFailure: async (attempt) => {
            successAttempt = attempt.attemptNumber + 1;
            await logModelCall(input.deps.db, {
              projectId: input.ctx.projectId,
              executionId: input.ctx.executionId,
              stage: input.stage,
              provider: attempt.provider,
              modelId: attempt.model,
              promptText: input.prompt,
              response: null,
              error: attempt.errorMessage,
              errorCode: attempt.errorCode,
              latencyMs: attempt.latencyMs,
              attemptNumber: attempt.attemptNumber,
            });
          },
        },
      )
    : await input.deps.orchestrator.callSingle('glm', input.prompt, {
        projectId: input.ctx.projectId,
      });
  await logModelCall(input.deps.db, {
    projectId: input.ctx.projectId,
    executionId: input.ctx.executionId,
    stage: input.stage,
    provider: response.provider,
    promptText: input.prompt,
    response,
    attemptNumber: successAttempt,
  });
  return response;
}
