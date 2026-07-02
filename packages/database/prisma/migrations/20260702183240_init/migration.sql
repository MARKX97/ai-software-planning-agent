-- CreateEnum
CREATE TYPE "WorkflowStage" AS ENUM ('init', 'requirement_analysis', 'requirement_clarification', 'multi_model_analysis', 'requirement_synthesis', 'feasibility_analysis', 'risk_analysis', 'mvp_compression', 'platform_recommendation', 'planning_generation', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('active', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'closed');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('success', 'failed', 'timeout', 'cancelled');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('success', 'failed', 'timeout', 'rate_limited');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('pending', 'processing', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('markdown', 'pdf', 'html', 'json');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('requirement_report', 'feasibility_report', 'risk_report', 'mvp_plan', 'platform_recommendation', 'project_plan', 'prd', 'architecture', 'frontend_spec', 'backend_spec', 'ai_coding_rules');

-- CreateEnum
CREATE TYPE "LLMProvider" AS ENUM ('deepseek', 'glm', 'minimax');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "original_idea" TEXT NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'active',
    "current_stage" "WorkflowStage" NOT NULL DEFAULT 'init',
    "requirement_text" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_states" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
    "status" "StageStatus" NOT NULL DEFAULT 'pending',
    "display_name" VARCHAR(100) NOT NULL,
    "progress" JSONB NOT NULL,
    "data_json" JSONB,
    "error_message" TEXT,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
    "status" "ExecutionStatus" NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "duration_ms" INTEGER,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_results" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "execution_id" UUID,
    "stage" "WorkflowStage" NOT NULL,
    "result_type" VARCHAR(50) NOT NULL,
    "schema_name" VARCHAR(100),
    "schema_version" VARCHAR(30),
    "content_json" JSONB NOT NULL,
    "content_text" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "type" "ArtifactType" NOT NULL,
    "type_display_name" VARCHAR(100) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "stage" "WorkflowStage" NOT NULL,
    "content" TEXT NOT NULL,
    "file_path" TEXT,
    "size_bytes" INTEGER,
    "format" VARCHAR(20) NOT NULL DEFAULT 'markdown',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'pending',
    "artifact_types" JSONB NOT NULL,
    "artifact_count" INTEGER NOT NULL DEFAULT 0,
    "file_path" TEXT,
    "file_size_bytes" INTEGER,
    "download_token_hash" VARCHAR(128),
    "download_expires_at" TIMESTAMPTZ,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "model_execution_logs" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "execution_id" UUID,
    "stage" "WorkflowStage" NOT NULL,
    "provider_name" "LLMProvider" NOT NULL,
    "model_id" VARCHAR(100) NOT NULL,
    "status" "CallStatus" NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "prompt_text" TEXT NOT NULL,
    "prompt_version_id" UUID,
    "response_text" TEXT,
    "structured_output" JSONB,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    "cost_input" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "cost_output" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "cost_total" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "latency_ms" INTEGER,
    "error_code" VARCHAR(50),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "model_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL,
    "prompt_name" VARCHAR(100) NOT NULL,
    "version" VARCHAR(30) NOT NULL,
    "content_hash" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_usage" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "total_input_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_output_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_tokens" INTEGER NOT NULL DEFAULT 0,
    "total_cost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "call_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "timeout_count" INTEGER NOT NULL DEFAULT 0,
    "rate_limited_count" INTEGER NOT NULL DEFAULT 0,
    "avg_latency_ms" INTEGER,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "token_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX "projects_current_stage_idx" ON "projects"("current_stage");

-- CreateIndex
CREATE INDEX "projects_created_at_idx" ON "projects"("created_at" DESC);

-- CreateIndex
CREATE INDEX "projects_deleted_at_idx" ON "projects"("deleted_at");

-- CreateIndex
CREATE INDEX "conversations_project_id_idx" ON "conversations"("project_id");

-- CreateIndex
CREATE INDEX "conversations_project_id_status_idx" ON "conversations"("project_id", "status");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_states_project_id_idx" ON "workflow_states"("project_id");

-- CreateIndex
CREATE INDEX "workflow_states_status_idx" ON "workflow_states"("status");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_project_id_stage_key" ON "workflow_states"("project_id", "stage");

-- CreateIndex
CREATE INDEX "workflow_executions_project_id_started_at_idx" ON "workflow_executions"("project_id", "started_at" DESC);

-- CreateIndex
CREATE INDEX "workflow_executions_project_id_stage_idx" ON "workflow_executions"("project_id", "stage");

-- CreateIndex
CREATE INDEX "workflow_executions_status_idx" ON "workflow_executions"("status");

-- CreateIndex
CREATE INDEX "analysis_results_project_id_stage_idx" ON "analysis_results"("project_id", "stage");

-- CreateIndex
CREATE INDEX "analysis_results_execution_id_idx" ON "analysis_results"("execution_id");

-- CreateIndex
CREATE INDEX "analysis_results_created_at_idx" ON "analysis_results"("created_at" DESC);

-- CreateIndex
CREATE INDEX "artifacts_project_id_idx" ON "artifacts"("project_id");

-- CreateIndex
CREATE INDEX "artifacts_project_id_type_idx" ON "artifacts"("project_id", "type");

-- CreateIndex
CREATE INDEX "artifacts_type_idx" ON "artifacts"("type");

-- CreateIndex
CREATE INDEX "artifacts_deleted_at_idx" ON "artifacts"("deleted_at");

-- CreateIndex
CREATE INDEX "exports_project_id_created_at_idx" ON "exports"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "exports_status_idx" ON "exports"("status");

-- CreateIndex
CREATE INDEX "exports_download_token_hash_idx" ON "exports"("download_token_hash");

-- CreateIndex
CREATE INDEX "model_execution_logs_project_id_created_at_idx" ON "model_execution_logs"("project_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "model_execution_logs_execution_id_idx" ON "model_execution_logs"("execution_id");

-- CreateIndex
CREATE INDEX "model_execution_logs_stage_idx" ON "model_execution_logs"("stage");

-- CreateIndex
CREATE INDEX "model_execution_logs_provider_name_idx" ON "model_execution_logs"("provider_name");

-- CreateIndex
CREATE INDEX "model_execution_logs_status_idx" ON "model_execution_logs"("status");

-- CreateIndex
CREATE INDEX "prompt_versions_created_at_idx" ON "prompt_versions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_prompt_name_version_key" ON "prompt_versions"("prompt_name", "version");

-- CreateIndex
CREATE UNIQUE INDEX "token_usage_project_id_key" ON "token_usage"("project_id");

-- CreateIndex
CREATE INDEX "token_usage_total_cost_idx" ON "token_usage"("total_cost" DESC);

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_states" ADD CONSTRAINT "workflow_states_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_executions" ADD CONSTRAINT "workflow_executions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_results" ADD CONSTRAINT "analysis_results_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_execution_logs" ADD CONSTRAINT "model_execution_logs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_execution_logs" ADD CONSTRAINT "model_execution_logs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "workflow_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "model_execution_logs" ADD CONSTRAINT "model_execution_logs_prompt_version_id_fkey" FOREIGN KEY ("prompt_version_id") REFERENCES "prompt_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_usage" ADD CONSTRAINT "token_usage_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
