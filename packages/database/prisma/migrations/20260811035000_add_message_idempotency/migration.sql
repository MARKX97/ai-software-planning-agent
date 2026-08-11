ALTER TABLE "messages"
  ADD COLUMN "idempotency_key" VARCHAR(240);

CREATE UNIQUE INDEX "messages_idempotency_key_key"
  ON "messages"("idempotency_key");
