BEGIN;

CREATE TABLE "tool_steps" (
  "id" UUID NOT NULL,
  "graph_run_id" UUID NOT NULL,
  "execution_id" UUID,
  "stage" "WorkflowStage" NOT NULL,
  "node" VARCHAR(100) NOT NULL,
  "tool" VARCHAR(64) NOT NULL,
  "call_number" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL,
  "arguments_json" JSONB NOT NULL,
  "result_json" JSONB,
  "result_count" INTEGER NOT NULL DEFAULT 0,
  "duration_ms" INTEGER,
  "error_code" VARCHAR(50),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "tool_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "tool_steps_call_number_check" CHECK ("call_number" >= 1),
  CONSTRAINT "tool_steps_result_count_check" CHECK ("result_count" >= 0),
  CONSTRAINT "tool_steps_duration_ms_check" CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0),
  CONSTRAINT "tool_steps_status_check" CHECK ("status" IN ('running', 'success', 'failed', 'rejected')),
  CONSTRAINT "tool_steps_graph_run_id_fkey" FOREIGN KEY ("graph_run_id") REFERENCES "graph_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "tool_steps_graph_run_id_stage_call_number_key"
  ON "tool_steps"("graph_run_id", "stage", "call_number");
CREATE INDEX "tool_steps_graph_run_id_created_at_idx" ON "tool_steps"("graph_run_id", "created_at");
CREATE INDEX "tool_steps_execution_id_idx" ON "tool_steps"("execution_id");

COMMIT;
