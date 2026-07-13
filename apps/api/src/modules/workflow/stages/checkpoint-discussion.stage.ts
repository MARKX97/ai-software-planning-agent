import { z } from 'zod';
import type { WorkflowContext, WorkflowStage } from '@ai-planning/shared';
import { renderPrompt } from '../../../prompts/prompt-template.js';
import { CHECKPOINT_DISCUSSION_PROMPT } from '../../../prompts/checkpoint-discussion.prompt.js';
import { stageDisplayName } from '../workflow-response.dto.js';
import type { StageDeps } from './stage-deps.js';
import { logModelCall } from './model-call-log.js';

const discussionSchema = z.object({ reply: z.string().min(1) });

export class CheckpointDiscussionStage {
  constructor(private readonly deps: StageDeps) {}

  async execute(ctx: WorkflowContext, checkpoint: WorkflowStage): Promise<string> {
    const result = ctx.resultsByStage[checkpoint];
    const prompt = renderPrompt(CHECKPOINT_DISCUSSION_PROMPT, {
      checkpointName: stageDisplayName(checkpoint),
      checkpointResult: JSON.stringify(result?.structuredOutput ?? ctx.originalIdea),
      conversationHistory: ctx.conversationHistory || '(none)',
    });
    const response = await this.deps.orchestrator.callSingle('glm', prompt, {
      outputSchema: discussionSchema,
      projectId: ctx.projectId,
    });
    await logModelCall(this.deps.db, {
      projectId: ctx.projectId,
      executionId: ctx.executionId,
      stage: checkpoint,
      provider: 'glm',
      promptText: prompt,
      response,
    });
    const parsed = discussionSchema.safeParse(response.structuredOutput);
    return parsed.success ? parsed.data.reply : '我已经记下这条反馈，会在后续规划中一并考虑。';
  }
}
