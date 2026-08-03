import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  reciprocalRankFusion,
  type KnowledgeSearchCandidate,
} from '../src/knowledge-vector.repository.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/knowledge-retrieval.json', import.meta.url), 'utf8'),
) as {
  vector: string[];
  text: string[];
  relevant: string[];
  minimumRecallAt8: number;
};

describe('knowledge retrieval eval', () => {
  it('meets the committed Recall@8 baseline with deterministic RRF', () => {
    const results = reciprocalRankFusion(
      fixture.vector.map(candidate),
      fixture.text.map(candidate),
      8,
    );
    const found = new Set(results.map((item) => item.chunkId));
    const recall = fixture.relevant.filter((id) => found.has(id)).length / fixture.relevant.length;
    assert.ok(recall >= fixture.minimumRecallAt8, `Recall@8 ${recall} missed baseline`);
    assert.deepEqual(
      results.slice(0, 2).map((item) => item.chunkId),
      ['chunk-a', 'chunk-c'],
    );
  });
});

function candidate(chunkId: string): KnowledgeSearchCandidate {
  return {
    sourceId: 'source',
    documentId: 'document',
    chunkId,
    title: chunkId,
    logicalPath: 'fixture.md',
    lineStart: 1,
    lineEnd: 1,
    pageNumber: null,
    content: chunkId,
    contentHash: 'a'.repeat(64),
  };
}
