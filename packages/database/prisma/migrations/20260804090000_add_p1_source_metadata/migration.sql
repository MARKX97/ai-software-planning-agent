BEGIN;

ALTER TABLE "knowledge_sources"
  ADD COLUMN "content_blob" BYTEA,
  ADD COLUMN "repository_commit" VARCHAR(64);

ALTER TABLE "knowledge_documents"
  ADD COLUMN "repository_commit" VARCHAR(64);

CREATE INDEX "knowledge_sources_project_id_repository_commit_idx"
  ON "knowledge_sources"("project_id", "repository_commit");

COMMIT;
