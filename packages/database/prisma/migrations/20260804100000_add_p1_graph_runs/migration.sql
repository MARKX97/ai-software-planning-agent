BEGIN;

CREATE TABLE "graph_runs" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "execution_id" UUID,
  "status" VARCHAR(20) NOT NULL,
  "current_node" VARCHAR(100) NOT NULL,
  "current_stage" "WorkflowStage" NOT NULL,
  "checkpoint_version" INTEGER NOT NULL DEFAULT 0,
  "waiting_for" VARCHAR(20),
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "graph_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "graph_runs_checkpoint_version_check" CHECK ("checkpoint_version" >= 0),
  CONSTRAINT "graph_runs_status_check" CHECK ("status" IN ('running', 'interrupted', 'completed', 'failed', 'cancelled')),
  CONSTRAINT "graph_runs_waiting_for_check" CHECK ("waiting_for" IS NULL OR "waiting_for" IN ('reply', 'review')),
  CONSTRAINT "graph_runs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "graph_runs_project_id_updated_at_idx" ON "graph_runs"("project_id", "updated_at" DESC);
CREATE INDEX "graph_runs_project_id_status_idx" ON "graph_runs"("project_id", "status");

COMMIT;
