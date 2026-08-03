BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "KnowledgeSourceKind" AS ENUM ('file', 'github_repository');
CREATE TYPE "KnowledgeStatus" AS ENUM (
  'pending',
  'processing',
  'ready',
  'ready_with_warnings',
  'failed',
  'deleted'
);

CREATE TABLE "knowledge_sources" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "kind" "KnowledgeSourceKind" NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100),
  "source_uri" TEXT,
  "content_hash" CHAR(64) NOT NULL,
  "status" "KnowledgeStatus" NOT NULL DEFAULT 'pending',
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(50),
  "error_message" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_sources_content_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "knowledge_sources_warning_count_check" CHECK ("warning_count" >= 0)
);

CREATE TABLE "knowledge_revisions" (
  "id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "status" "KnowledgeStatus" NOT NULL DEFAULT 'processing',
  "embedding_model" VARCHAR(100),
  "embedding_dimensions" INTEGER,
  "warning_count" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(50),
  "error_message" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "knowledge_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_revisions_content_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "knowledge_revisions_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "knowledge_revisions_dimensions_check" CHECK ("embedding_dimensions" IS NULL OR "embedding_dimensions" > 0),
  CONSTRAINT "knowledge_revisions_warning_count_check" CHECK ("warning_count" >= 0),
  CONSTRAINT "knowledge_revisions_active_status_check" CHECK (NOT "is_active" OR "status" IN ('ready', 'ready_with_warnings'))
);

CREATE TABLE "knowledge_documents" (
  "id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "revision_id" UUID NOT NULL,
  "logical_path" TEXT NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(100) NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_documents_content_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$')
);

CREATE TABLE "knowledge_chunks" (
  "id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL,
  "title_path" JSONB,
  "page_number" INTEGER,
  "line_start" INTEGER,
  "line_end" INTEGER,
  "content_hash" CHAR(64) NOT NULL,
  "embedding" vector,
  "search_vector" TSVECTOR GENERATED ALWAYS AS (to_tsvector('simple', "content")) STORED,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_chunks_content_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "knowledge_chunks_position_check" CHECK ("position" >= 0),
  CONSTRAINT "knowledge_chunks_token_count_check" CHECK ("token_count" >= 0),
  CONSTRAINT "knowledge_chunks_page_number_check" CHECK ("page_number" IS NULL OR "page_number" > 0),
  CONSTRAINT "knowledge_chunks_line_range_check" CHECK (
    ("line_start" IS NULL AND "line_end" IS NULL)
    OR ("line_start" > 0 AND "line_end" >= "line_start")
  )
);

CREATE TABLE "artifact_citations" (
  "id" UUID NOT NULL,
  "artifact_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "chunk_id" UUID NOT NULL,
  "citation_key" VARCHAR(20) NOT NULL,
  "position" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "locator" TEXT NOT NULL,
  "excerpt" TEXT NOT NULL,
  "content_hash" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "artifact_citations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "artifact_citations_content_hash_check" CHECK ("content_hash" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "artifact_citations_position_check" CHECK ("position" > 0),
  CONSTRAINT "artifact_citations_excerpt_check" CHECK (char_length("excerpt") BETWEEN 1 AND 2000)
);

CREATE INDEX "knowledge_sources_project_id_status_idx" ON "knowledge_sources"("project_id", "status");
CREATE INDEX "knowledge_sources_project_id_content_hash_idx" ON "knowledge_sources"("project_id", "content_hash");
CREATE INDEX "knowledge_sources_deleted_at_idx" ON "knowledge_sources"("deleted_at");
CREATE UNIQUE INDEX "knowledge_sources_project_content_active_key"
  ON "knowledge_sources"("project_id", "content_hash") WHERE "deleted_at" IS NULL;

CREATE UNIQUE INDEX "knowledge_revisions_source_id_revision_key" ON "knowledge_revisions"("source_id", "revision");
CREATE UNIQUE INDEX "knowledge_revisions_source_id_content_hash_key" ON "knowledge_revisions"("source_id", "content_hash");
CREATE UNIQUE INDEX "knowledge_revisions_source_id_id_key" ON "knowledge_revisions"("source_id", "id");
CREATE INDEX "knowledge_revisions_source_id_is_active_idx" ON "knowledge_revisions"("source_id", "is_active");
CREATE UNIQUE INDEX "knowledge_revisions_one_active_key"
  ON "knowledge_revisions"("source_id") WHERE "is_active";

CREATE UNIQUE INDEX "knowledge_documents_revision_id_logical_path_key" ON "knowledge_documents"("revision_id", "logical_path");
CREATE INDEX "knowledge_documents_source_id_revision_id_idx" ON "knowledge_documents"("source_id", "revision_id");
CREATE UNIQUE INDEX "knowledge_chunks_document_id_position_key" ON "knowledge_chunks"("document_id", "position");
CREATE INDEX "knowledge_chunks_search_vector_idx" ON "knowledge_chunks" USING GIN ("search_vector");

CREATE UNIQUE INDEX "artifact_citations_artifact_id_citation_key_key" ON "artifact_citations"("artifact_id", "citation_key");
CREATE UNIQUE INDEX "artifact_citations_artifact_id_chunk_id_key" ON "artifact_citations"("artifact_id", "chunk_id");
CREATE INDEX "artifact_citations_artifact_id_position_idx" ON "artifact_citations"("artifact_id", "position");
CREATE INDEX "artifact_citations_source_id_idx" ON "artifact_citations"("source_id");
CREATE INDEX "artifact_citations_chunk_id_idx" ON "artifact_citations"("chunk_id");

ALTER TABLE "knowledge_sources"
  ADD CONSTRAINT "knowledge_sources_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_revisions"
  ADD CONSTRAINT "knowledge_revisions_source_id_fkey"
  FOREIGN KEY ("source_id") REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_documents"
  ADD CONSTRAINT "knowledge_documents_source_id_revision_id_fkey"
  FOREIGN KEY ("source_id", "revision_id") REFERENCES "knowledge_revisions"("source_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "knowledge_chunks"
  ADD CONSTRAINT "knowledge_chunks_document_id_fkey"
  FOREIGN KEY ("document_id") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "artifact_citations"
  ADD CONSTRAINT "artifact_citations_artifact_id_fkey"
  FOREIGN KEY ("artifact_id") REFERENCES "artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

COMMIT;
