import type { WorkflowContext, WorkflowStage } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { CHECKPOINT_DISCUSSION_PROMPT } from '../../../prompts/checkpoint-discussion.prompt.js';
import { stageDisplayName } from '../workflow-response.dto.js';
import type { StageDeps } from './stage-deps.js';
import { logModelCall } from './model-call-log.js';

export class CheckpointDiscussionStage {
  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext, checkpoint: WorkflowStage): Promise<string> {
    const result = ctx.resultsByStage[checkpoint];
    const prompt = renderPrompt(CHECKPOINT_DISCUSSION_PROMPT, {
      checkpointName: stageDisplayName(checkpoint),
      checkpointResult: JSON.stringify(result?.structuredOutput ?? ctx.originalIdea),
      conversationHistory: ctx.conversationHistory || '(none)',
    });
    const stream = this.deps.stream;
    const response = stream
      ? await this.deps.orchestrator.callSingleStream('glm', prompt, {
          projectId: ctx.projectId,
          ...stream,
        })
      : await this.deps.orchestrator.callSingle('glm', prompt, { projectId: ctx.projectId });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: checkpoint,
      provider: 'glm',
      promptText: prompt,
      response,
    });
    return response.content;
  }
}
