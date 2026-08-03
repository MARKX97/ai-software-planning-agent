import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  artifactCitationSchema,
  evidenceCitationSchema,
  knowledgeSearchRequestSchema,
} from '../src/schemas/knowledge.schema.js';

describe('knowledge schemas', () => {
  it('defaults top_k and rejects project or result boundary violations', () => {
    assert.equal(knowledgeSearchRequestSchema.parse({ query: 'architecture' }).top_k, 8);
    assert.equal(knowledgeSearchRequestSchema.safeParse({ query: 'x', top_k: 9 }).success, false);
    assert.equal(
      evidenceCitationSchema.safeParse({
        sourceId: 'not-a-uuid',
        documentId: 'not-a-uuid',
        chunkId: 'not-a-uuid',
        title: 'Architecture',
        locator: 'section 1',
        excerpt: 'evidence',
        contentHash: 'x'.repeat(64),
      }).success,
      false,
    );
  });

  it('accepts only bounded artifact citation keys', () => {
    const citation = {
      sourceId: '550e8400-e29b-41d4-a716-446655440000',
      documentId: '550e8400-e29b-41d4-a716-446655440001',
      chunkId: '550e8400-e29b-41d4-a716-446655440002',
      title: 'Architecture',
      locator: 'guide.md:L1-L4',
      excerpt: 'PostgreSQL is required.',
      contentHash: 'a'.repeat(64),
    };
    assert.equal(
      artifactCitationSchema.safeParse({ ...citation, citationKey: 'S1' }).success,
      true,
    );
    assert.equal(
      artifactCitationSchema.safeParse({ ...citation, citationKey: 'S9' }).success,
      false,
    );
  });
});
