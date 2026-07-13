import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { UUID_V4_PIPE } from '../../common/pipes/uuid-validation.pipe.js';
import { ConversationsService } from './conversations.service.js';
import {
  listMessagesQuerySchema,
  sendMessageSchema,
  type ConversationResponse,
  type ListMessagesQuery,
  type MessageListResponse,
  type MessageResponse,
  type SendMessageRequest,
} from './conversations.dto.js';

/**
 * Conversations + Messages endpoints.
 * @internal
 */
@ApiTags('Conversations')
@Controller('projects/:project_id/conversations')
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建对话' })
  async create(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
  ): Promise<ConversationResponse> {
    return this.conversations.create(projectId);
  }

  @Post(':conversation_id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '发送消息' })
  @UsePipes(new ZodValidationPipe(sendMessageSchema))
  async sendMessage(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('conversation_id', UUID_V4_PIPE) conversationId: string,
    @Body() body: SendMessageRequest,
  ): Promise<MessageResponse> {
    return this.conversations.sendMessage(projectId, conversationId, body);
  }

  @Get(':conversation_id/messages')
  @ApiOperation({ summary: '获取消息历史' })
  @UsePipes(new ZodValidationPipe(listMessagesQuerySchema))
  async listMessages(
    @Param('project_id', UUID_V4_PIPE) projectId: string,
    @Param('conversation_id', UUID_V4_PIPE) conversationId: string,
    @Query() query: ListMessagesQuery,
  ): Promise<MessageListResponse> {
    return this.conversations.listMessages(projectId, conversationId, query);
  }
}
