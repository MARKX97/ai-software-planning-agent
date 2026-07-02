-- Enforce one active artifact per project and artifact type while allowing
-- historical soft-deleted duplicates.
CREATE UNIQUE INDEX "artifacts_project_id_type_active_key"
  ON "artifacts"("project_id", "type")
  WHERE "deleted_at" IS NULL;
