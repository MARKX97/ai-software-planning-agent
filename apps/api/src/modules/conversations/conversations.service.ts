import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/database.module.js';
import { AppException } from '../../common/exception/app-exception.js';
import { ErrorCode } from '../../common/exception/error-code.js';
import { ProjectsService } from '../projects/projects.service.js';
import {
  toConversationResponse,
  toMessageResponse,
  type ConversationResponse,
  type ListMessagesQuery,
  type MessageListResponse,
  type MessageResponse,
  type SendMessageRequest,
} from './conversations.dto.js';

/**
 * Conversations + Messages service backed by Prisma.
 * @internal
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly db: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async create(projectId: string): Promise<ConversationResponse> {
    await this.projects.findOrFail(projectId);
    const now = new Date();
    const conversation = await this.db.client.conversation.create({
      data: { project_id: projectId, status: 'active', updated_at: now },
    });
    return toConversationResponse(conversation);
  }

  async sendMessage(
    projectId: string,
    conversationId: string,
    input: SendMessageRequest,
  ): Promise<MessageResponse> {
    await this.projects.findOrFail(projectId);
    await this.findConversationOrFail(projectId, conversationId);
    const message = await this.db.client.message.create({
      data: { conversation_id: conversationId, role: 'user', content: input.content },
    });
    return toMessageResponse(message);
  }

  async listMessages(
    projectId: string,
    conversationId: string,
    query: ListMessagesQuery,
  ): Promise<MessageListResponse> {
    await this.projects.findOrFail(projectId);
    await this.findConversationOrFail(projectId, conversationId);
    const where = { conversation_id: conversationId };
    const [items, total] = await Promise.all([
      this.db.client.message.findMany({
        where,
        orderBy: { created_at: 'asc' },
        skip: query.offset,
        take: query.limit,
      }),
      this.db.client.message.count({ where }),
    ]);
    return {
      items: items.map(toMessageResponse),
      total,
      offset: query.offset,
      limit: query.limit,
    };
  }

  /** Find a conversation; ensure it belongs to the project, else 404. */
  async findConversationOrFail(projectId: string, conversationId: string) {
    const conversation = await this.db.client.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation || conversation.project_id !== projectId) {
      throw AppException.notFound(
        ErrorCode.CONVERSATION_NOT_FOUND,
        `Conversation '${conversationId}' not found in project '${projectId}'`,
      );
    }
    return conversation;
  }
}
