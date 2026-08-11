ALTER TABLE "graph_runs"
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ;

CREATE INDEX "graph_runs_status_lease_expires_at_idx"
  ON "graph_runs"("status", "lease_expires_at");
