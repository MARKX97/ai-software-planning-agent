import { z } from 'zod';
import type { Conversation, Message } from '@ai-planning/database';
import { safeUserTextSchema } from '../../common/security/sensitive-text.js';

/**
 * Zod schemas + DTOs for Conversations endpoints.
 * Source: contracts/openapi.yaml → ConversationResponse / MessageResponse.
 * @internal
 */
export const sendMessageSchema = z.object({
  content: safeUserTextSchema(50000),
});

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;

export const listMessagesQuerySchema = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export interface ConversationResponse {
  id: string;
  project_id: string;
  status: string;
  created_at: string;
}

export interface MessageResponse {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface MessageListResponse {
  items: MessageResponse[];
  total: number;
  offset: number;
  limit: number;
}

/** Convert a Prisma Conversation row to the API response shape. */
export function toConversationResponse(c: Conversation): ConversationResponse {
  return {
    id: c.id,
    project_id: c.project_id,
    status: c.status,
    created_at: c.created_at.toISOString(),
  };
}

/** Convert a Prisma Message row to the API response shape. */
export function toMessageResponse(m: Message): MessageResponse {
  return {
    id: m.id,
    conversation_id: m.conversation_id,
    role: m.role,
    content: m.content,
    metadata: (m.metadata as Record<string, unknown> | null) ?? null,
    created_at: m.created_at.toISOString(),
  };
}
