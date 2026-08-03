BEGIN;

ALTER TABLE "knowledge_sources" ADD COLUMN "content_text" TEXT;

DROP INDEX "knowledge_revisions_source_id_content_hash_key";
ALTER TABLE "knowledge_revisions"
  ADD COLUMN "indexer_version" VARCHAR(50) NOT NULL DEFAULT 'p0-v1';
ALTER TABLE "knowledge_revisions" ALTER COLUMN "indexer_version" DROP DEFAULT;

COMMIT;
