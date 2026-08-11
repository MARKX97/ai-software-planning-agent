import type { Message } from '@ai-planning/database';
import type { StageResult, WorkflowContext } from '@ai-planning/shared';
import type { PrismaService } from '../../database/database.module.js';
import { graphStageKey } from './workflow-idempotency.js';
import { checkpointIntroduction, type WorkflowWait } from './workflow-checkpoints.js';
import {
  appendCheckpointIntroduction,
  appendWorkflowInteraction,
} from './workflow-conversation.js';

interface PersistWorkflowCheckpointInput {
  readonly db: PrismaService;
  readonly workflowConversationId: string;
  readonly userMessage?: string;
  readonly context: WorkflowContext;
  readonly result: StageResult;
  readonly waitingFor: WorkflowWait;
}

export async function persistWorkflowCheckpoint(
  input: PersistWorkflowCheckpointInput,
): Promise<Message> {
  const key = graphStageKey(input.context, input.result.stage, 'checkpoint');
  if (key) {
    const existing = await input.db.client.message.findUnique({
      where: { idempotency_key: `${key}:assistant` },
    });
    if (existing) return existing;
  }
  if (input.waitingFor === 'reply') {
    return appendWorkflowInteraction(input.db, {
      conversationId: input.workflowConversationId,
      userContent: input.userMessage,
      assistantContent: input.result.content || '需求信息已经更新。',
      stage: input.result.stage,
      kind: 'clarification_reply',
      questions: clarificationQuestions(input.result),
      idempotencyKey: key,
    });
  }
  return appendCheckpointIntroduction({
    db: input.db,
    projectId: input.context.projectId,
    content: checkpointIntroduction(input.result.stage),
    stage: input.result.stage,
    kind: 'checkpoint_intro',
    idempotencyKey: key,
  });
}

export function loadWorkflowCheckpointMessage(
  db: PrismaService,
  conversationId: string,
): Promise<Message | null> {
  return db.client.message.findFirst({
    where: {
      conversation_id: conversationId,
      role: 'assistant',
      metadata: { path: ['workflow'], equals: true },
    },
    orderBy: { created_at: 'desc' },
  });
}

function clarificationQuestions(result: StageResult): unknown[] | null {
  const output = result.structuredOutput;
  if (!output || typeof output !== 'object' || Array.isArray(output)) return null;
  const questions = (output as Record<string, unknown>)['clarification_questions'];
  return Array.isArray(questions) ? questions : null;
}
