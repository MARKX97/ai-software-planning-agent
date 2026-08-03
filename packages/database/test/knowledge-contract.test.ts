import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const schema = readFileSync(new URL('../prisma/schema.prisma', import.meta.url), 'utf8');
const migration = readFileSync(
  new URL(
    '../prisma/migrations/20260803120000_add_v3_knowledge_contract/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const indexingMigration = readFileSync(
  new URL(
    '../prisma/migrations/20260803150000_add_v3_knowledge_indexing/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const repository = readFileSync(
  new URL('../src/knowledge-vector.repository.ts', import.meta.url),
  'utf8',
);

describe('V3 knowledge database contract', () => {
  it('keeps the migration atomic and enables pgvector', () => {
    assert.match(migration, /^BEGIN;/);
    assert.match(migration, /CREATE EXTENSION IF NOT EXISTS vector;/);
    assert.match(migration, /COMMIT;\s*$/);
  });

  it('defines source, revision, document, chunk, and citation persistence', () => {
    for (const model of [
      'KnowledgeSource',
      'KnowledgeRevision',
      'KnowledgeDocument',
      'KnowledgeChunk',
      'ArtifactCitation',
    ]) {
      assert.match(schema, new RegExp(`model ${model} \\{`));
    }
    assert.match(migration, /knowledge_sources_project_content_active_key/);
    assert.match(migration, /knowledge_revisions_one_active_key/);
    assert.match(migration, /knowledge_chunks_search_vector_idx/);
  });

  it('persists reindex input without blocking retry revisions', () => {
    assert.match(indexingMigration, /^BEGIN;/);
    assert.match(indexingMigration, /ADD COLUMN "content_text" TEXT/);
    assert.match(indexingMigration, /DROP INDEX "knowledge_revisions_source_id_content_hash_key"/);
    assert.match(indexingMigration, /ADD COLUMN "indexer_version"/);
    assert.match(indexingMigration, /COMMIT;\s*$/);
    assert.doesNotMatch(schema, /@@unique\(\[source_id, content_hash\]\)/);
  });

  it('keeps hybrid search project and active revision filters in the database repository', () => {
    assert.match(repository, /ks\."project_id" = \$\{input\.projectId\}::uuid/g);
    assert.match(repository, /kr\."is_active" = true/g);
    assert.match(repository, /knowledge_chunks/);
    assert.match(repository, /websearch_to_tsquery/);
    assert.match(repository, /SEARCH_BRANCH_LIMIT = 20/);
    assert.match(repository, /RRF_K = 60/);
  });
});
