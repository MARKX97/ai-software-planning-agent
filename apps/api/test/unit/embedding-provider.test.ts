import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AppConfigService } from '../../src/config/app-config.service.js';
import { EmbeddingProvider } from '../../src/modules/knowledge/embedding.provider.js';

const runReal = process.env['RUN_REAL_EMBEDDING'] === '1';

describe('EmbeddingProvider', () => {
  it('returns deterministic, finite fixed-dimension Mock vectors', async () => {
    const provider = new EmbeddingProvider({
      embeddingProvider: 'mock',
      embeddingModel: 'mock-v1',
      embeddingDimensions: 8,
    } as never);
    const first = await provider.embedDocuments(['same text', 'different text']);
    const second = await provider.embedDocuments(['same text']);
    assert.deepEqual(first[0], second[0]);
    assert.notDeepEqual(first[0], first[1]);
    assert.ok(first.every((vector) => vector.length === 8 && vector.every(Number.isFinite)));
  });

  it('fails fast when remote Embedding configuration is incomplete', () => {
    assert.throws(
      () =>
        new EmbeddingProvider({
          embeddingProvider: 'openai-compatible',
          embeddingBaseUrl: '',
          embeddingApiKey: '',
          embeddingModel: 'remote',
          embeddingDimensions: 8,
        } as never),
      /EMBEDDING_BASE_URL/,
    );
  });

  it('calls the explicitly configured real Embedding endpoint', { skip: !runReal }, async () => {
    const config = new AppConfigService();
    assert.equal(config.embeddingProvider, 'openai-compatible');
    const vectors = await new EmbeddingProvider(config).embedDocuments(['embedding smoke test']);
    assert.equal(vectors[0]?.length, config.embeddingDimensions);
  });
});
