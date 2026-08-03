import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { KnowledgeRetrievalService } from '../../src/modules/knowledge/knowledge-retrieval.service.js';

const row = {
  sourceId: '550e8400-e29b-41d4-a716-446655440000',
  documentId: '550e8400-e29b-41d4-a716-446655440001',
  chunkId: '550e8400-e29b-41d4-a716-446655440002',
  title: 'Architecture',
  logicalPath: 'guide.md',
  lineStart: 2,
  lineEnd: 4,
  pageNumber: null,
  content: 'Use PostgreSQL. api_key=abcdefghijklmnopqrstuvwxyz1234',
  contentHash: 'a'.repeat(64),
};

describe('KnowledgeRetrievalService', () => {
  it('maps fused candidates to bounded, redacted evidence', async () => {
    const service = new KnowledgeRetrievalService(
      db(async () => [row]) as never,
      { findOrFail: async () => ({ id: 'project' }) } as never,
      embeddings(true) as never,
    );
    const result = await service.search('550e8400-e29b-41d4-a716-446655440003', {
      query: 'PostgreSQL',
      top_k: 8,
    });
    assert.equal(result.insufficient_evidence, false);
    assert.equal(result.items[0]?.locator, 'guide.md:L2-L4');
    assert.doesNotMatch(result.items[0]?.excerpt ?? '', /abcdefghijklmnopqrstuvwxyz1234/);
  });

  it('skips query Embedding when RAG is disabled', async () => {
    let embedded = false;
    const provider = embeddings(false, () => (embedded = true));
    const service = new KnowledgeRetrievalService(
      db(async () => [row]) as never,
      { findOrFail: async () => ({ id: 'project' }) } as never,
      provider as never,
    );
    const result = await service.search('550e8400-e29b-41d4-a716-446655440003', {
      query: 'PostgreSQL',
      top_k: 8,
    });
    assert.deepEqual(result, { items: [], insufficient_evidence: true });
    assert.equal(embedded, false);
  });

  it('maps database failures to a safe availability error', async () => {
    const service = new KnowledgeRetrievalService(
      db(async () => Promise.reject(new Error('raw SQL detail'))) as never,
      { findOrFail: async () => ({ id: 'project' }) } as never,
      embeddings(true) as never,
    );
    await assert.rejects(
      () =>
        service.search('550e8400-e29b-41d4-a716-446655440003', {
          query: 'PostgreSQL',
          top_k: 8,
        }),
      (error: unknown) =>
        (error as { code?: string }).code === ErrorCode.KNOWLEDGE_UNAVAILABLE &&
        !String((error as Error).message).includes('raw SQL detail'),
    );
  });
});

function db(query: () => Promise<unknown>) {
  return {
    client: {
      knowledgeSource: { count: async () => 1 },
      $queryRaw: query,
    },
  };
}

function embeddings(enabled: boolean, onEmbed: () => void = () => undefined) {
  return {
    retrievalEnabled: enabled,
    model: 'mock-embedding-v1',
    dimensions: 8,
    embedDocuments: async () => {
      onEmbed();
      return [[1, 0, 0, 0, 0, 0, 0, 0]];
    },
  };
}
