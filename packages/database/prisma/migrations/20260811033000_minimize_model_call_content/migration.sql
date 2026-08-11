ALTER TABLE "model_execution_logs"
  ADD COLUMN "prompt_hash" VARCHAR(64),
  ADD COLUMN "prompt_length" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "response_length" INTEGER,
  ADD COLUMN "response_summary" VARCHAR(200);

UPDATE "model_execution_logs"
SET
  "prompt_hash" = encode(sha256(convert_to("prompt_text", 'UTF8')), 'hex'),
  "prompt_length" = char_length("prompt_text"),
  "response_length" = CASE
    WHEN "response_text" IS NULL THEN NULL
    ELSE char_length("response_text")
  END,
  "response_summary" = CASE
    WHEN "response_text" IS NULL THEN NULL
    ELSE '模型调用成功，响应内容已按隐私策略省略。'
  END;

ALTER TABLE "model_execution_logs"
  ALTER COLUMN "prompt_hash" SET NOT NULL,
  ADD CONSTRAINT "model_execution_logs_prompt_length_check" CHECK ("prompt_length" >= 0),
  ADD CONSTRAINT "model_execution_logs_response_length_check" CHECK ("response_length" IS NULL OR "response_length" >= 0),
  DROP COLUMN "prompt_text",
  DROP COLUMN "response_text",
  DROP COLUMN "structured_output";
