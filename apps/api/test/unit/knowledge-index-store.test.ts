import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KnowledgeIndexStore } from '../../src/modules/knowledge/knowledge-index.store.js';

describe('KnowledgeIndexStore failure fallback', () => {
  it('keeps a source searchable when an older active revision exists', async () => {
    const writes: Array<Record<string, unknown>> = [];
    const tx = {
      knowledgeRevision: {
        findFirst: async () => ({ status: 'ready', warning_count: 0 }),
        update: async (input: { data: Record<string, unknown> }) => writes.push(input.data),
      },
      knowledgeSource: {
        update: async (input: { data: Record<string, unknown> }) => writes.push(input.data),
      },
    };
    const store = new KnowledgeIndexStore({
      client: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) },
    } as never);

    await store.fail('source-1', 'revision-2', new Error('private detail'));

    assert.equal(writes[0]?.['status'], 'failed');
    assert.equal(writes[0]?.['is_active'], false);
    assert.equal(writes[1]?.['status'], 'ready_with_warnings');
    assert.equal(writes[1]?.['error_message'], 'Knowledge indexing failed');
  });

  it('fails the source when no active revision exists', async () => {
    const sourceWrites: Array<Record<string, unknown>> = [];
    const tx = {
      knowledgeRevision: {
        findFirst: async () => null,
        update: async () => undefined,
      },
      knowledgeSource: {
        update: async (input: { data: Record<string, unknown> }) => sourceWrites.push(input.data),
      },
    };
    const store = new KnowledgeIndexStore({
      client: { $transaction: (run: (client: typeof tx) => unknown) => run(tx) },
    } as never);

    await store.fail('source-1', 'revision-1', new Error());

    assert.equal(sourceWrites[0]?.['status'], 'failed');
  });
});
