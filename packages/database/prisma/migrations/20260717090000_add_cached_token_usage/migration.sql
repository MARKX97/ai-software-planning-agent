ALTER TABLE "model_execution_logs"
ADD COLUMN "cached_tokens" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "cost_cached" NUMERIC(10, 6) NOT NULL DEFAULT 0;

ALTER TABLE "token_usage"
ADD COLUMN "total_cached_tokens" INTEGER NOT NULL DEFAULT 0;
