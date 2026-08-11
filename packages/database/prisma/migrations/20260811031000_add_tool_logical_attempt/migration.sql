BEGIN;

ALTER TABLE "tool_steps"
  ADD COLUMN "logical_attempt" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "tool_steps_logical_attempt_check" CHECK ("logical_attempt" >= 1);

DROP INDEX "tool_steps_graph_run_id_stage_call_number_key";
CREATE UNIQUE INDEX "tool_steps_graph_run_id_stage_logical_attempt_call_number_key"
  ON "tool_steps"("graph_run_id", "stage", "logical_attempt", "call_number");

COMMIT;
