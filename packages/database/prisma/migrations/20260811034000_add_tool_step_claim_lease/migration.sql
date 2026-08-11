ALTER TABLE "tool_steps"
  ADD COLUMN "claim_token" VARCHAR(36),
  ADD COLUMN "lease_expires_at" TIMESTAMPTZ;

CREATE INDEX "tool_steps_status_lease_expires_at_idx"
  ON "tool_steps"("status", "lease_expires_at");
