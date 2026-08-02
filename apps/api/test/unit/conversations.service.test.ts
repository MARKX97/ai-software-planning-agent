import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { ConversationsService } from '../../src/modules/conversations/conversations.service.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');
const conversation = {
  id: 'conversation-1',
  project_id: 'project-1',
  status: 'active',
  created_at: createdAt,
  updated_at: createdAt,
} as never;
const message = {
  id: 'message-1',
  conversation_id: 'conversation-1',
  role: 'user',
  content: 'hello',
  metadata: null,
  created_at: createdAt,
} as never;

describe('ConversationsService', () => {
  it('creates a conversation only after validating its project', async () => {
    const calls: string[] = [];
    const db = {
      client: {
        conversation: {
          create: async () => {
            calls.push('create');
            return conversation;
          },
        },
      },
    };
    const service = new ConversationsService(
      db as never,
      {
        findOrFail: async () => calls.push('project'),
      } as never,
    );
    const result = await service.create('project-1');
    assert.deepEqual(calls, ['project', 'create']);
    assert.equal(result.id, 'conversation-1');
  });

  it('sends and lists messages using ascending pagination', async () => {
    let createData: unknown;
    let listArgs: unknown;
    const db = {
      client: {
        conversation: { findUnique: async () => conversation },
        message: {
          create: async (args: { data: unknown }) => {
            createData = args.data;
            return message;
          },
          findMany: async (args: unknown) => {
            listArgs = args;
            return [message];
          },
          count: async () => 1,
        },
      },
    };
    const service = new ConversationsService(
      db as never,
      { findOrFail: async () => ({}) } as never,
    );
    await service.sendMessage('project-1', 'conversation-1', { content: 'hello' });
    const result = await service.listMessages('project-1', 'conversation-1', {
      offset: 5,
      limit: 10,
    });
    assert.deepEqual(createData, {
      conversation_id: 'conversation-1',
      role: 'user',
      content: 'hello',
    });
    assert.deepEqual(listArgs, {
      where: { conversation_id: 'conversation-1' },
      orderBy: { created_at: 'asc' },
      skip: 5,
      take: 10,
    });
    assert.equal(result.total, 1);
  });

  it('rejects conversations owned by another project', async () => {
    const db = {
      client: {
        conversation: { findUnique: async () => ({ ...conversation, project_id: 'project-2' }) },
      },
    };
    const service = new ConversationsService(
      db as never,
      { findOrFail: async () => ({}) } as never,
    );
    await assert.rejects(
      () => service.findConversationOrFail('project-1', 'conversation-1'),
      (error: unknown) =>
        'code' in (error as object) &&
        (error as { code: string }).code === ErrorCode.CONVERSATION_NOT_FOUND,
    );
  });
});
