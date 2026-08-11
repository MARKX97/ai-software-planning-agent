import type { PrismaService } from '../../database/database.module.js';
import type { Message, Prisma } from '@ai-planning/database';
import { WorkflowStage } from '@ai-planning/shared';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { decisionSnapshotsFromMessages } from './workflow-decisions.js';
import type { DecisionSnapshot } from '@ai-planning/shared';

export interface WorkflowConversationContext {
  readonly history: string;
  readonly clarificationRound: number;
  readonly confirmedDecisions: readonly DecisionSnapshot[];
}

export interface ResolveWorkflowConversationInput {
  readonly projectId: string;
  readonly requestedId?: string;
  readonly reuseLatest?: boolean;
}

/** Reuse a requested conversation or create one for this workflow run. */
export async function resolveWorkflowConversation(
  db: PrismaService,
  input: ResolveWorkflowConversationInput,
): Promise<string> {
  const { projectId, requestedId, reuseLatest = false } = input;
  if (requestedId) {
    await findConversationOrFail(db, projectId, requestedId);
    return requestedId;
  }
  if (reuseLatest) {
    const latest = await db.client.conversation.findFirst({
      where: { project_id: projectId },
      orderBy: { updated_at: 'desc' },
      select: { id: true },
    });
    if (latest) {
      await db.client.conversation.update({
        where: { id: latest.id },
        data: { status: 'active', updated_at: new Date() },
      });
      return latest.id;
    }
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
  const allMessages = conversations.flatMap((item) => item.messages);
  const messages = conversation.messages.filter((message) => !isDecisionSnapshot(message));
  return {
    history: messages.map((message) => `${message.role}: ${message.content}`).join('\n'),
    clarificationRound: conversation.messages.filter((message) => message.role === 'user').length,
    confirmedDecisions: decisionSnapshotsFromMessages(allMessages),
  };
}

export interface WorkflowInteractionInput {
  readonly conversationId: string;
  readonly userContent?: string;
  readonly assistantContent: string;
  readonly stage: WorkflowStage;
  readonly kind?: string;
  readonly questions?: unknown[] | null;
  readonly idempotencyKey?: string;
}

/** Persist a completed user/assistant interaction atomically. */
export async function appendWorkflowInteraction(
  db: PrismaService,
  input: WorkflowInteractionInput,
): Promise<Message> {
  return db.client.$transaction(async (tx) => {
    await persistUserMessage(tx, input);
    const assistant = await persistAssistantMessage(tx, input);
    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { status: 'active', updated_at: new Date() },
    });
    return assistant;
  });
}

async function persistUserMessage(
  tx: Prisma.TransactionClient,
  input: WorkflowInteractionInput,
): Promise<void> {
  if (!input.userContent) return;
  const data = {
    conversation_id: input.conversationId,
    role: 'user' as const,
    content: input.userContent,
    idempotency_key: input.idempotencyKey ? `${input.idempotencyKey}:user` : null,
  };
  if (!input.idempotencyKey) {
    await tx.message.create({ data });
    return;
  }
  await tx.message.upsert({
    where: { idempotency_key: data.idempotency_key! },
    create: data,
    update: {},
  });
}

function persistAssistantMessage(
  tx: Prisma.TransactionClient,
  input: WorkflowInteractionInput,
): Promise<Message> {
  const data = {
    conversation_id: input.conversationId,
    role: 'assistant' as const,
    content: input.assistantContent,
    metadata: {
      workflow: true,
      kind: input.kind ?? 'workflow_discussion',
      checkpoint_stage: input.stage,
      ...(input.questions ? { questions: input.questions } : {}),
    } as never,
    idempotency_key: input.idempotencyKey ? `${input.idempotencyKey}:assistant` : null,
  };
  if (!input.idempotencyKey) return tx.message.create({ data });
  return tx.message.upsert({
    where: { idempotency_key: data.idempotency_key! },
    create: data,
    update: {},
  });
}

interface CheckpointIntroductionInput {
  readonly db: PrismaService;
  readonly projectId: string;
  readonly content: string;
  readonly stage: WorkflowStage;
  readonly kind?: string;
  readonly idempotencyKey?: string;
}

/** Create a review conversation and its first message as one idempotent side effect. */
export async function appendCheckpointIntroduction(
  input: CheckpointIntroductionInput,
): Promise<Message> {
  const { db, projectId, ...reply } = input;
  return db.client.$transaction(async (tx) => {
    const key = reply.idempotencyKey ? `${reply.idempotencyKey}:assistant` : undefined;
    const existing = key ? await tx.message.findUnique({ where: { idempotency_key: key } }) : null;
    if (existing) return existing;
    const conversation = await tx.conversation.create({
      data: { project_id: projectId, status: 'active', updated_at: new Date() },
    });
    const message = await persistAssistantMessage(tx, {
      conversationId: conversation.id,
      assistantContent: reply.content,
      stage: reply.stage,
      kind: reply.kind,
      idempotencyKey: reply.idempotencyKey,
    });
    if (message.conversation_id !== conversation.id) {
      await tx.conversation.delete({ where: { id: conversation.id } });
    }
    return message;
  });
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

function isDecisionSnapshot(message: { metadata: unknown }): boolean {
  if (!message.metadata || typeof message.metadata !== 'object') return false;
  return (message.metadata as Record<string, unknown>)['kind'] === 'decision_snapshot';
}
