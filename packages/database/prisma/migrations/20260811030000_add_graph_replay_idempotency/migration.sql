BEGIN;

ALTER TABLE "graph_runs"
  ADD COLUMN "logical_attempt" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "analysis_results"
  ADD COLUMN "result_json" JSONB,
  ADD COLUMN "idempotency_key" VARCHAR(200);

ALTER TABLE "artifacts"
  ADD COLUMN "idempotency_key" VARCHAR(200);

ALTER TABLE "model_execution_logs"
  ADD COLUMN "idempotency_key" VARCHAR(200);

ALTER TABLE "graph_runs"
  ADD CONSTRAINT "graph_runs_logical_attempt_check" CHECK ("logical_attempt" >= 1);

CREATE INDEX "graph_runs_execution_id_idx" ON "graph_runs"("execution_id");
CREATE UNIQUE INDEX "analysis_results_idempotency_key_key" ON "analysis_results"("idempotency_key");
CREATE UNIQUE INDEX "artifacts_idempotency_key_key" ON "artifacts"("idempotency_key");
CREATE UNIQUE INDEX "model_execution_logs_idempotency_key_key" ON "model_execution_logs"("idempotency_key");

COMMIT;
