import type { PrismaService } from '../../database/database.module.js';
import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { checkpointIntroduction } from './workflow-checkpoints.js';

export interface WorkflowConversationContext {
  readonly history: string;
  readonly clarificationRound: number;
}

/** Reuse a requested conversation or create one for this workflow run. */
export async function resolveWorkflowConversation(
  db: PrismaService,
  projectId: string,
  requestedId?: string,
): Promise<string> {
  if (requestedId) {
    await findConversationOrFail(db, projectId, requestedId);
    return requestedId;
  }
  const conversation = await db.client.conversation.create({
    data: { project_id: projectId, status: 'active', updated_at: new Date() },
  });
  return conversation.id;
}

/** Load project history and the persisted round count for the active conversation. */
export async function loadWorkflowConversationContext(
  db: PrismaService,
  projectId: string,
  conversationId: string,
): Promise<WorkflowConversationContext> {
  const conversations = await db.client.conversation.findMany({
    where: { project_id: projectId },
    orderBy: { created_at: 'asc' },
    include: { messages: { orderBy: { created_at: 'asc' } } },
  });
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    throwConversationNotFound(projectId, conversationId);
  }
  const messages = conversations
    .filter((item) => item.id === conversationId || item.messages.some(isWorkflowMessage))
    .flatMap((item) => item.messages);
  return {
    history: messages.map((message) => `${message.role}: ${message.content}`).join('\n'),
    clarificationRound: conversation.messages.filter((message) => message.role === 'user').length,
  };
}

export async function appendUserReply(
  db: PrismaService,
  conversationId: string,
  content: string,
): Promise<void> {
  const now = new Date();
  await db.client.$transaction([
    db.client.message.create({ data: { conversation_id: conversationId, role: 'user', content } }),
    db.client.conversation.update({
      where: { id: conversationId },
      data: { status: 'active', updated_at: now },
    }),
  ]);
}

export async function appendClarificationQuestions(
  db: PrismaService,
  conversationId: string,
  questions: unknown[] | null,
): Promise<void> {
  if (!questions?.length) return;
  const content = questions
    .map((question, index) => `${index + 1}. ${questionText(question)}`)
    .join('\n');
  const now = new Date();
  await db.client.$transaction([
    db.client.message.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content,
        metadata: {
          workflow: true,
          kind: 'clarification_questions',
          checkpoint_stage: WorkflowStage.REQUIREMENT_CLARIFICATION,
          questions,
        } as never,
      },
    }),
    db.client.conversation.update({
      where: { id: conversationId },
      data: { status: 'active', updated_at: now },
    }),
  ]);
}

export async function openCheckpointConversation(
  db: PrismaService,
  projectId: string,
): Promise<string> {
  const now = new Date();
  const conversation = await db.client.conversation.create({
    data: { project_id: projectId, status: 'active', updated_at: now },
  });
  return conversation.id;
}

export async function appendCheckpointIntroduction(
  db: PrismaService,
  conversationId: string,
  stage: WorkflowStage,
): Promise<void> {
  await appendAgentReply(
    db,
    conversationId,
    checkpointIntroduction(stage),
    stage,
    'checkpoint_intro',
  );
}

export async function appendAgentReply(
  db: PrismaService,
  conversationId: string,
  content: string,
  stage: WorkflowStage,
  kind = 'workflow_discussion',
): Promise<void> {
  const now = new Date();
  await db.client.$transaction([
    db.client.message.create({
      data: {
        conversation_id: conversationId,
        role: 'assistant',
        content,
        metadata: { workflow: true, kind, checkpoint_stage: stage } as never,
      },
    }),
    db.client.conversation.update({
      where: { id: conversationId },
      data: { status: 'active', updated_at: now },
    }),
  ]);
}

export async function closeWorkflowConversation(
  db: PrismaService,
  conversationId: string,
): Promise<void> {
  await db.client.conversation.update({
    where: { id: conversationId },
    data: { status: 'closed', updated_at: new Date() },
  });
}

async function findConversationOrFail(
  db: PrismaService,
  projectId: string,
  conversationId: string,
): Promise<void> {
  const conversation = await db.client.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation || conversation.project_id !== projectId) {
    throwConversationNotFound(projectId, conversationId);
  }
}

function throwConversationNotFound(projectId: string, conversationId: string): never {
  throw AppException.notFound(
    ErrorCode.CONVERSATION_NOT_FOUND,
    `Conversation '${conversationId}' not found in project '${projectId}'`,
  );
}

function questionText(question: unknown): string {
  if (typeof question === 'string') return question;
  if (question && typeof question === 'object') {
    const record = question as Record<string, unknown>;
    const text = record['question'] ?? record['content'] ?? record['text'];
    if (typeof text === 'string') return text;
  }
  return '请补充更多信息';
}

function isWorkflowMessage(message: { role: string; metadata: unknown }): boolean {
  if (message.role !== 'assistant' || !message.metadata || typeof message.metadata !== 'object') {
    return false;
  }
  return (message.metadata as Record<string, unknown>)['workflow'] === true;
}
