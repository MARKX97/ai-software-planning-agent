import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { ErrorCode } from '../../src/common/exception/error-code.js';
import { EmbeddingError } from '../../src/modules/knowledge/embedding.provider.js';
import { KnowledgeIndexerService } from '../../src/modules/knowledge/knowledge-indexer.service.js';
import type { ParsedKnowledgeDocument } from '../../src/modules/knowledge/knowledge-parser.js';

const chunks = Array.from({ length: 33 }, (_, position) => ({
  position,
  content: `chunk-${position}`,
  tokenCount: 2,
  titlePath: [],
  lineStart: position + 1,
  lineEnd: position + 1,
  contentHash: String(position).padStart(64, '0'),
}));

const document: ParsedKnowledgeDocument = {
  name: 'fixture.txt',
  mimeType: 'text/plain',
  content: 'fixture',
  contentHash: 'a'.repeat(64),
  title: 'fixture',
  chunks,
};

describe('KnowledgeIndexerService', () => {
  it('commits successful batches and records partial Embedding failures as warnings', async () => {
    let call = 0;
    let completed: Record<string, unknown> | undefined;
    const store = {
      begin: async () => ({ id: 'revision-1', number: 1 }),
      complete: async (input: Record<string, unknown>) => {
        completed = input;
      },
      fail: async () => assert.fail('partial failure must remain usable'),
    };
    const provider = {
      model: 'mock-v1',
      dimensions: 2,
      embedDocuments: async (texts: readonly string[]) => {
        call += 1;
        if (call === 2) throw new EmbeddingError('EMBEDDING_FAILED');
        return texts.map(() => [0.5, -0.5]);
      },
    };
    await new KnowledgeIndexerService(store as never, provider as never, {} as never).index(
      'project-1',
      'source-1',
      document,
    );
    assert.equal(completed?.['warningCount'], 1);
    assert.equal((completed?.['chunks'] as unknown[]).length, 32);
  });

  it('marks a new revision failed when every Embedding batch fails', async () => {
    let failed = false;
    const store = {
      begin: async () => ({ id: 'revision-2', number: 2 }),
      complete: async () => assert.fail('failed revision must not commit'),
      fail: async () => {
        failed = true;
      },
    };
    const provider = {
      model: 'mock-v1',
      dimensions: 2,
      embedDocuments: async () => Promise.reject(new EmbeddingError('EMBEDDING_FAILED')),
    };
    await assert.rejects(
      () =>
        new KnowledgeIndexerService(store as never, provider as never, {} as never).index(
          'project-1',
          'source-1',
          document,
        ),
      (error: unknown) => (error as { code?: string }).code === ErrorCode.KNOWLEDGE_INDEXING_FAILED,
    );
    assert.equal(failed, true);
  });
});
