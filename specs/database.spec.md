# Database — System Contract

> Version: 1.4.0
> Status: Contract
> Owner: Backend Lead
> Tokens: ~8,000

---

## 1. 数据库选型

| 属性     | 值             |
| -------- | -------------- |
| 数据库   | PostgreSQL 16  |
| ORM      | Prisma 6       |
| 字符集   | UTF-8          |
| 时区     | UTC            |
| 主键策略 | UUID v4        |
| 迁移工具 | Prisma Migrate |
| 向量扩展 | pgvector 0.8.2 |

## 2. 表清单

| 表名                   | 说明              |
| ---------------------- | ----------------- |
| `projects`             | 项目实体          |
| `conversations`        | 对话会话          |
| `messages`             | 对话消息          |
| `workflow_states`      | 工作流状态快照    |
| `workflow_executions`  | 工作流执行历史    |
| `analysis_results`     | 阶段分析结果      |
| `artifacts`            | 产物实体          |
| `exports`              | 导出任务          |
| `model_execution_logs` | 模型调用日志      |
| `prompt_versions`      | Prompt 版本记录   |
| `token_usage`          | 项目级 Token 汇总 |
| `knowledge_sources`    | 项目知识源        |
| `knowledge_revisions`  | 知识源索引版本    |
| `knowledge_documents`  | 规范化文档        |
| `knowledge_chunks`     | 检索 Chunk        |
| `artifact_citations`   | 产物引用快照      |

## 3. 通用字段规则

| 字段         | 规则                                                       |
| ------------ | ---------------------------------------------------------- |
| `id`         | 所有表使用 UUID v4 主键                                    |
| `created_at` | 除纯汇总表外必须存在，`TIMESTAMPTZ NOT NULL DEFAULT NOW()` |
| `updated_at` | 可变实体必须存在，业务更新时同步刷新                       |
| `deleted_at` | 仅软删除实体使用，查询默认过滤                             |
| JSON 字段    | PostgreSQL 使用 `JSONB`，Prisma 使用 `Json`                |
| 金额字段     | 使用 `NUMERIC(12,6)` 或更小精度，不使用 float              |

## 4. 表结构

### 4.1 projects

| 字段               | 类型         | 约束                                                        |
| ------------------ | ------------ | ----------------------------------------------------------- |
| `id`               | UUID         | PK                                                          |
| `name`             | VARCHAR(200) | NOT NULL                                                    |
| `original_idea`    | TEXT         | NOT NULL                                                    |
| `status`           | VARCHAR(20)  | NOT NULL, DEFAULT `active`, CHECK `active/completed/failed` |
| `current_stage`    | VARCHAR(50)  | NOT NULL, DEFAULT `init`, CHECK WorkflowStage               |
| `requirement_text` | TEXT         | NULL                                                        |
| `error_message`    | TEXT         | NULL                                                        |
| `started_at`       | TIMESTAMPTZ  | NULL                                                        |
| `completed_at`     | TIMESTAMPTZ  | NULL                                                        |
| `created_at`       | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                     |
| `updated_at`       | TIMESTAMPTZ  | NOT NULL                                                    |
| `deleted_at`       | TIMESTAMPTZ  | NULL                                                        |

### 4.2 conversations

| 字段         | 类型        | 约束                                              |
| ------------ | ----------- | ------------------------------------------------- |
| `id`         | UUID        | PK                                                |
| `project_id` | UUID        | FK -> projects, NOT NULL                          |
| `status`     | VARCHAR(20) | NOT NULL, DEFAULT `active`, CHECK `active/closed` |
| `created_at` | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                           |
| `updated_at` | TIMESTAMPTZ | NOT NULL                                          |

### 4.3 messages

| 字段              | 类型        | 约束                                    |
| ----------------- | ----------- | --------------------------------------- |
| `id`              | UUID        | PK                                      |
| `conversation_id` | UUID        | FK -> conversations, NOT NULL           |
| `role`            | VARCHAR(20) | NOT NULL, CHECK `user/assistant/system` |
| `content`         | TEXT        | NOT NULL                                |
| `metadata`        | JSONB       | NULL                                    |
| `created_at`      | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                 |

### 4.4 workflow_states

| 字段            | 类型         | 约束                                           |
| --------------- | ------------ | ---------------------------------------------- |
| `id`            | UUID         | PK                                             |
| `project_id`    | UUID         | FK -> projects, NOT NULL                       |
| `stage`         | VARCHAR(50)  | NOT NULL, CHECK WorkflowStage                  |
| `status`        | VARCHAR(20)  | NOT NULL, DEFAULT `pending`, CHECK StageStatus |
| `display_name`  | VARCHAR(100) | NOT NULL                                       |
| `progress`      | JSONB        | NOT NULL                                       |
| `data_json`     | JSONB        | NULL                                           |
| `error_message` | TEXT         | NULL                                           |
| `started_at`    | TIMESTAMPTZ  | NULL                                           |
| `completed_at`  | TIMESTAMPTZ  | NULL                                           |
| `created_at`    | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                        |
| `updated_at`    | TIMESTAMPTZ  | NOT NULL                                       |

**UNIQUE**: `(project_id, stage)`

### 4.5 workflow_executions

| 字段            | 类型        | 约束                                               |
| --------------- | ----------- | -------------------------------------------------- |
| `id`            | UUID        | PK                                                 |
| `project_id`    | UUID        | FK -> projects, NOT NULL                           |
| `stage`         | VARCHAR(50) | NOT NULL, CHECK WorkflowStage                      |
| `status`        | VARCHAR(20) | NOT NULL, CHECK `success/failed/timeout/cancelled` |
| `started_at`    | TIMESTAMPTZ | NOT NULL                                           |
| `completed_at`  | TIMESTAMPTZ | NULL                                               |
| `duration_ms`   | INTEGER     | NULL                                               |
| `error_message` | TEXT        | NULL                                               |
| `retry_count`   | INTEGER     | NOT NULL, DEFAULT 0                                |
| `created_at`    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()                            |

### 4.6 analysis_results

| 字段             | 类型         | 约束                                                |
| ---------------- | ------------ | --------------------------------------------------- |
| `id`             | UUID         | PK                                                  |
| `project_id`     | UUID         | FK -> projects, NOT NULL                            |
| `execution_id`   | UUID         | FK -> workflow_executions, NULL, ON DELETE SET NULL |
| `stage`          | VARCHAR(50)  | NOT NULL, CHECK WorkflowStage                       |
| `result_type`    | VARCHAR(50)  | NOT NULL                                            |
| `schema_name`    | VARCHAR(100) | NULL                                                |
| `schema_version` | VARCHAR(30)  | NULL                                                |
| `content_json`   | JSONB        | NOT NULL                                            |
| `content_text`   | TEXT         | NULL                                                |
| `created_at`     | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                             |

### 4.7 artifacts

| 字段                | 类型         | 约束                          |
| ------------------- | ------------ | ----------------------------- |
| `id`                | UUID         | PK                            |
| `project_id`        | UUID         | FK -> projects, NOT NULL      |
| `type`              | VARCHAR(50)  | NOT NULL, CHECK ArtifactType  |
| `type_display_name` | VARCHAR(100) | NOT NULL                      |
| `title`             | VARCHAR(200) | NOT NULL                      |
| `stage`             | VARCHAR(50)  | NOT NULL, CHECK WorkflowStage |
| `content`           | TEXT         | NOT NULL                      |
| `file_path`         | TEXT         | NULL                          |
| `size_bytes`        | INTEGER      | NULL                          |
| `format`            | VARCHAR(20)  | NOT NULL, DEFAULT `markdown`  |
| `created_at`        | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()       |
| `updated_at`        | TIMESTAMPTZ  | NOT NULL                      |
| `deleted_at`        | TIMESTAMPTZ  | NULL                          |

**UNIQUE**: `(project_id, type)` for non-deleted rows.

### 4.8 exports

| 字段                  | 类型         | 约束                                                                     |
| --------------------- | ------------ | ------------------------------------------------------------------------ |
| `id`                  | UUID         | PK                                                                       |
| `project_id`          | UUID         | FK -> projects, NOT NULL                                                 |
| `format`              | VARCHAR(20)  | NOT NULL, CHECK `markdown/pdf/html/json`                                 |
| `status`              | VARCHAR(20)  | NOT NULL, DEFAULT `pending`, CHECK `pending/processing/completed/failed` |
| `artifact_types`      | JSONB        | NOT NULL                                                                 |
| `artifact_count`      | INTEGER      | NOT NULL, DEFAULT 0                                                      |
| `file_path`           | TEXT         | NULL                                                                     |
| `file_size_bytes`     | INTEGER      | NULL                                                                     |
| `download_token_hash` | VARCHAR(128) | NULL                                                                     |
| `download_expires_at` | TIMESTAMPTZ  | NULL                                                                     |
| `error_message`       | TEXT         | NULL                                                                     |
| `created_at`          | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                                                  |
| `completed_at`        | TIMESTAMPTZ  | NULL                                                                     |

### 4.9 model_execution_logs

| 字段                | 类型          | 约束                                                  |
| ------------------- | ------------- | ----------------------------------------------------- |
| `id`                | UUID          | PK                                                    |
| `project_id`        | UUID          | FK -> projects, NOT NULL                              |
| `execution_id`      | UUID          | FK -> workflow_executions, NULL, ON DELETE SET NULL   |
| `stage`             | VARCHAR(50)   | NOT NULL, CHECK WorkflowStage                         |
| `provider_name`     | VARCHAR(50)   | NOT NULL, CHECK LLMProvider                           |
| `model_id`          | VARCHAR(100)  | NOT NULL                                              |
| `status`            | VARCHAR(20)   | NOT NULL, CHECK `success/failed/timeout/rate_limited` |
| `attempt_number`    | INTEGER       | NOT NULL, DEFAULT 1                                   |
| `prompt_text`       | TEXT          | NOT NULL                                              |
| `prompt_version_id` | UUID          | FK -> prompt_versions, NULL, ON DELETE SET NULL       |
| `response_text`     | TEXT          | NULL                                                  |
| `structured_output` | JSONB         | NULL                                                  |
| `input_tokens`      | INTEGER       | NOT NULL, DEFAULT 0                                   |
| `output_tokens`     | INTEGER       | NOT NULL, DEFAULT 0                                   |
| `cached_tokens`     | INTEGER       | NOT NULL, DEFAULT 0                                   |
| `cost_input`        | NUMERIC(10,6) | NOT NULL, DEFAULT 0                                   |
| `cost_output`       | NUMERIC(10,6) | NOT NULL, DEFAULT 0                                   |
| `cost_cached`       | NUMERIC(10,6) | NOT NULL, DEFAULT 0                                   |
| `cost_total`        | NUMERIC(10,6) | NOT NULL, DEFAULT 0                                   |
| `latency_ms`        | INTEGER       | NULL                                                  |
| `error_code`        | VARCHAR(50)   | NULL                                                  |
| `error_message`     | TEXT          | NULL                                                  |
| `created_at`        | TIMESTAMPTZ   | NOT NULL, DEFAULT NOW()                               |

### 4.10 prompt_versions

| 字段           | 类型         | 约束                    |
| -------------- | ------------ | ----------------------- |
| `id`           | UUID         | PK                      |
| `prompt_name`  | VARCHAR(100) | NOT NULL                |
| `version`      | VARCHAR(30)  | NOT NULL                |
| `content_hash` | VARCHAR(128) | NOT NULL                |
| `description`  | TEXT         | NULL                    |
| `created_at`   | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW() |

**UNIQUE**: `(prompt_name, version)`

### 4.11 token_usage

| 字段                  | 类型          | 约束                            |
| --------------------- | ------------- | ------------------------------- |
| `id`                  | UUID          | PK                              |
| `project_id`          | UUID          | UNIQUE FK -> projects, NOT NULL |
| `total_input_tokens`  | INTEGER       | NOT NULL, DEFAULT 0             |
| `total_output_tokens` | INTEGER       | NOT NULL, DEFAULT 0             |
| `total_cached_tokens` | INTEGER       | NOT NULL, DEFAULT 0             |
| `total_tokens`        | INTEGER       | NOT NULL, DEFAULT 0             |
| `total_cost`          | NUMERIC(12,6) | NOT NULL, DEFAULT 0             |
| `call_count`          | INTEGER       | NOT NULL, DEFAULT 0             |
| `success_count`       | INTEGER       | NOT NULL, DEFAULT 0             |
| `failed_count`        | INTEGER       | NOT NULL, DEFAULT 0             |
| `timeout_count`       | INTEGER       | NOT NULL, DEFAULT 0             |
| `rate_limited_count`  | INTEGER       | NOT NULL, DEFAULT 0             |
| `avg_latency_ms`      | INTEGER       | NULL                            |
| `updated_at`          | TIMESTAMPTZ   | NOT NULL                        |

### 4.12 knowledge_sources

| 字段            | 类型         | 约束                                               |
| --------------- | ------------ | -------------------------------------------------- |
| `id`            | UUID         | PK                                                 |
| `project_id`    | UUID         | FK -> projects, NOT NULL                           |
| `kind`          | VARCHAR(30)  | NOT NULL, CHECK KnowledgeSourceKind                |
| `name`          | VARCHAR(255) | NOT NULL                                           |
| `mime_type`     | VARCHAR(100) | NULL                                               |
| `source_uri`    | TEXT         | NULL                                               |
| `content_hash`  | CHAR(64)     | NOT NULL, SHA-256 hex                              |
| `content_text`  | TEXT         | NULL，P0 规范化原文；软删除时清除                  |
| `status`        | VARCHAR(30)  | NOT NULL, DEFAULT `pending`, CHECK KnowledgeStatus |
| `warning_count` | INTEGER      | NOT NULL, DEFAULT 0                                |
| `error_code`    | VARCHAR(50)  | NULL                                               |
| `error_message` | TEXT         | NULL，必须脱敏                                     |
| `created_at`    | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                            |
| `updated_at`    | TIMESTAMPTZ  | NOT NULL                                           |
| `deleted_at`    | TIMESTAMPTZ  | NULL                                               |

同一项目中，未删除来源的 `content_hash` 唯一；重复上传相同内容必须复用已有来源。

### 4.13 knowledge_revisions

| 字段                   | 类型         | 约束                                                  |
| ---------------------- | ------------ | ----------------------------------------------------- |
| `id`                   | UUID         | PK                                                    |
| `source_id`            | UUID         | FK -> knowledge_sources, NOT NULL                     |
| `revision`             | INTEGER      | NOT NULL，从 1 递增                                   |
| `content_hash`         | CHAR(64)     | NOT NULL, SHA-256 hex                                 |
| `status`               | VARCHAR(30)  | NOT NULL, DEFAULT `processing`, CHECK KnowledgeStatus |
| `embedding_model`      | VARCHAR(100) | NULL                                                  |
| `embedding_dimensions` | INTEGER      | NULL                                                  |
| `indexer_version`      | VARCHAR(50)  | NOT NULL                                              |
| `warning_count`        | INTEGER      | NOT NULL, DEFAULT 0                                   |
| `error_code`           | VARCHAR(50)  | NULL                                                  |
| `error_message`        | TEXT         | NULL，必须脱敏                                        |
| `is_active`            | BOOLEAN      | NOT NULL, DEFAULT FALSE                               |
| `created_at`           | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()                               |
| `completed_at`         | TIMESTAMPTZ  | NULL                                                  |

**UNIQUE**: `(source_id, revision)`；每个来源最多一个 `is_active = TRUE` 的 revision。相同内容只有在 Embedding 模型、维度和 indexer version 也相同时才复用 active revision；失败 revision 不得成为 active，且不得阻止同配置重试。

### 4.14 knowledge_documents

| 字段           | 类型         | 约束                                |
| -------------- | ------------ | ----------------------------------- |
| `id`           | UUID         | PK                                  |
| `source_id`    | UUID         | NOT NULL；与 revision 组成复合外键  |
| `revision_id`  | UUID         | FK -> knowledge_revisions, NOT NULL |
| `logical_path` | TEXT         | NOT NULL                            |
| `title`        | VARCHAR(255) | NOT NULL                            |
| `mime_type`    | VARCHAR(100) | NOT NULL                            |
| `content_hash` | CHAR(64)     | NOT NULL, SHA-256 hex               |
| `metadata`     | JSONB        | NULL，只保存解析元数据              |
| `created_at`   | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()             |

**UNIQUE**: `(revision_id, logical_path)`；复合外键保证 `revision_id` 属于同一 `source_id`。

### 4.15 knowledge_chunks

| 字段            | 类型        | 约束                                |
| --------------- | ----------- | ----------------------------------- |
| `id`            | UUID        | PK                                  |
| `document_id`   | UUID        | FK -> knowledge_documents, NOT NULL |
| `position`      | INTEGER     | NOT NULL，从 0 递增                 |
| `content`       | TEXT        | NOT NULL                            |
| `token_count`   | INTEGER     | NOT NULL                            |
| `title_path`    | JSONB       | NULL，Markdown 标题层级             |
| `page_number`   | INTEGER     | NULL                                |
| `line_start`    | INTEGER     | NULL                                |
| `line_end`      | INTEGER     | NULL                                |
| `content_hash`  | CHAR(64)    | NOT NULL, SHA-256 hex               |
| `embedding`     | VECTOR      | NULL，维度由 revision 记录          |
| `search_vector` | TSVECTOR    | 由 `content` 生成                   |
| `created_at`    | TIMESTAMPTZ | NOT NULL, DEFAULT NOW()             |

**UNIQUE**: `(document_id, position)`；向量与全文查询必须通过 document/revision/source 关联在 SQL 层过滤 `project_id` 和 active revision。

### 4.16 artifact_citations

| 字段           | 类型         | 约束                                  |
| -------------- | ------------ | ------------------------------------- |
| `id`           | UUID         | PK                                    |
| `artifact_id`  | UUID         | FK -> artifacts, NOT NULL             |
| `source_id`    | UUID         | NOT NULL，生成时来源 ID 快照          |
| `document_id`  | UUID         | NOT NULL，生成时文档 ID 快照          |
| `chunk_id`     | UUID         | NOT NULL，生成时 Chunk ID 快照        |
| `citation_key` | VARCHAR(20)  | NOT NULL，例如 `S1`                   |
| `position`     | INTEGER      | NOT NULL，从 1 递增                   |
| `title`        | VARCHAR(255) | NOT NULL，生成时快照                  |
| `locator`      | TEXT         | NOT NULL，生成时快照                  |
| `excerpt`      | TEXT         | NOT NULL，脱敏且最多 2,000 字符的快照 |
| `content_hash` | CHAR(64)     | NOT NULL，生成时 Chunk hash           |
| `created_at`   | TIMESTAMPTZ  | NOT NULL, DEFAULT NOW()               |

**UNIQUE**: `(artifact_id, citation_key)`、`(artifact_id, chunk_id)`。三个知识实体 ID 是审计快照，不设外键；来源清理后引用仍保留。
产物与本次实际使用的引用通过同一次 Prisma nested create 写入。向量与全文分支各在数据库包的唯一知识检索 Repository 中执行项目、active revision 和来源过滤；RRF 在同一 Repository 的纯函数中完成。

## 5. 枚举约束

| 枚举                | 值                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WorkflowStage       | init, requirement_analysis, requirement_clarification, multi_model_analysis, requirement_synthesis, feasibility_analysis, risk_analysis, mvp_compression, platform_recommendation, planning_generation, completed, failed |
| ProjectStatus       | active, completed, failed                                                                                                                                                                                                 |
| ConversationStatus  | active, closed                                                                                                                                                                                                            |
| MessageRole         | user, assistant, system                                                                                                                                                                                                   |
| StageStatus         | pending, running, completed, failed, skipped                                                                                                                                                                              |
| ExecutionStatus     | success, failed, timeout, cancelled                                                                                                                                                                                       |
| CallStatus          | success, failed, timeout, rate_limited                                                                                                                                                                                    |
| ExportStatus        | pending, processing, completed, failed                                                                                                                                                                                    |
| ExportFormat        | markdown, pdf, html, json                                                                                                                                                                                                 |
| ArtifactType        | requirement_report, feasibility_report, risk_report, mvp_plan, platform_recommendation, project_plan, prd, architecture, frontend_spec, backend_spec, ai_coding_rules                                                     |
| LLMProvider         | deepseek, glm, minimax                                                                                                                                                                                                    |
| KnowledgeSourceKind | file, github_repository                                                                                                                                                                                                   |
| KnowledgeStatus     | pending, processing, ready, ready_with_warnings, failed, deleted                                                                                                                                                          |

## 6. 外键删除策略

| 子表                 | 父表                | 删除策略 |
| -------------------- | ------------------- | -------- |
| conversations        | projects            | CASCADE  |
| messages             | conversations       | CASCADE  |
| workflow_states      | projects            | CASCADE  |
| workflow_executions  | projects            | CASCADE  |
| analysis_results     | projects            | CASCADE  |
| analysis_results     | workflow_executions | SET NULL |
| artifacts            | projects            | CASCADE  |
| exports              | projects            | CASCADE  |
| model_execution_logs | projects            | CASCADE  |
| model_execution_logs | workflow_executions | SET NULL |
| model_execution_logs | prompt_versions     | SET NULL |
| token_usage          | projects            | CASCADE  |
| knowledge_sources    | projects            | CASCADE  |
| knowledge_revisions  | knowledge_sources   | CASCADE  |
| knowledge_documents  | knowledge_revisions | CASCADE  |
| knowledge_chunks     | knowledge_documents | CASCADE  |
| artifact_citations   | artifacts           | CASCADE  |

## 7. 索引设计

| 表                   | 索引                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------- |
| projects             | `(status)`, `(current_stage)`, `(created_at DESC)`, `(deleted_at)`                          |
| conversations        | `(project_id)`, `(project_id, status)`                                                      |
| messages             | `(conversation_id, created_at ASC)`                                                         |
| workflow_states      | `(project_id)`, `(project_id, stage UNIQUE)`, `(status)`                                    |
| workflow_executions  | `(project_id, started_at DESC)`, `(project_id, stage)`, `(status)`                          |
| analysis_results     | `(project_id, stage)`, `(execution_id)`, `(created_at DESC)`                                |
| artifacts            | `(project_id)`, `(project_id, type)`, `(type)`, `(deleted_at)`                              |
| exports              | `(project_id, created_at DESC)`, `(status)`, `(download_token_hash)`                        |
| model_execution_logs | `(project_id, created_at DESC)`, `(execution_id)`, `(stage)`, `(provider_name)`, `(status)` |
| prompt_versions      | `(prompt_name, version UNIQUE)`, `(created_at DESC)`                                        |
| token_usage          | `(project_id UNIQUE)`, `(total_cost DESC)`                                                  |
| knowledge_sources    | `(project_id, status)`, `(project_id, content_hash)`、`(deleted_at)`                        |
| knowledge_revisions  | `(source_id, revision UNIQUE)`、`(source_id) WHERE is_active`                               |
| knowledge_documents  | `(source_id, revision_id)`、`(revision_id, logical_path UNIQUE)`                            |
| knowledge_chunks     | `(document_id, position UNIQUE)`、GIN `(search_vector)`                                     |
| artifact_citations   | `(artifact_id, position)`、`(source_id)`、`(chunk_id)`                                      |

## 8. 实现约束

- Prisma model 必须使用 `@@map("<table_name>")` 映射 snake_case 表名。
- Prisma 字段可用 camelCase，但必须通过 `@map("<column_name>")` 映射到 snake_case。
- Controller 不直接返回 Prisma 实体，必须通过 DTO 映射。
- 软删除查询默认过滤 `deleted_at IS NULL`。
- `download_token_hash` 只存 hash，不存明文下载 token。
- `prompt_text` 和 `response_text` 可能包含用户输入，日志展示接口必须走鉴权。
- `embedding` 和 `search_vector` 只能由数据库包访问；向量 SQL 必须参数化并在 SQL 层过滤项目与 active revision。
- 知识源内容、Chunk、Embedding 和引用 excerpt 禁止写入日志；`error_message` 只保存脱敏信息。

## 9. 版本兼容

- 新增字段必须设置 DEFAULT 或允许 NULL。
- 字段不可直接删除，先标记 deprecated，MAJOR 版本再移除。
- 枚举值只新增，不删除、不重命名。
- 索引可新增；删除索引必须确认查询路径已迁移。
