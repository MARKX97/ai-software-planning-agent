# Schema — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: Backend Lead
> Tokens: ~8,000

---

## 1. Schema 分工

| 类型                  | 权威来源                                       | 用途                                      |
| --------------------- | ---------------------------------------------- | ----------------------------------------- |
| 数据库实体字段        | `specs/database.spec.md`                       | Prisma schema、迁移、数据库约束           |
| API 请求/响应 Schema  | `contracts/openapi.yaml`                       | Controller DTO、前端 API Client、契约测试 |
| LLM 结构化输出 Schema | `contracts/schemas/llm/*.json` + 本文档第 2 节 | Prompt 输出校验、阶段结果存储             |
| 枚举                  | 本文档第 3 节 + `specs/database.spec.md`       | shared enums、DB CHECK、DTO 校验          |

本文档不重复维护完整数据库实体字段，避免与 `database.spec.md` 漂移。

## 2. LLM 结构化输出 Schema

### 2.1 RequirementPoint

| 字段          | 类型                                  | 必填 |
| ------------- | ------------------------------------- | ---- |
| `id`          | string                                | 是   |
| `title`       | string                                | 是   |
| `description` | string                                | 是   |
| `priority`    | P0/P1/P2/P3                           | 是   |
| `category`    | functional/non_functional/ux/business | 是   |
| `user_story`  | string                                | 否   |

### 2.2 RequirementAnalysisResult

| 字段                      | 类型               | 必填 |
| ------------------------- | ------------------ | ---- |
| `project_summary`         | string             | 是   |
| `target_users`            | string[]           | 是   |
| `core_problems`           | string[]           | 是   |
| `requirement_points`      | RequirementPoint[] | 是   |
| `assumptions`             | string[]           | 是   |
| `clarification_questions` | string[]           | 是   |

### 2.3 MultiModelAnalysisResult

| 字段                 | 类型               | 必填 |
| -------------------- | ------------------ | ---- |
| `model_name`         | string             | 是   |
| `requirement_points` | RequirementPoint[] | 是   |
| `strengths`          | string[]           | 是   |
| `weaknesses`         | string[]           | 是   |
| `unknowns`           | string[]           | 是   |
| `recommendation`     | string             | 是   |

### 2.4 SynthesizedRequirement

| 字段                          | 类型               | 必填 |
| ----------------------------- | ------------------ | ---- |
| `project_name`                | string             | 是   |
| `executive_summary`           | string             | 是   |
| `user_personas`               | string[]           | 是   |
| `functional_requirements`     | RequirementPoint[] | 是   |
| `non_functional_requirements` | RequirementPoint[] | 是   |
| `conflicts_resolved`          | ConflictItem[]     | 是   |
| `scope_boundary`              | string             | 是   |

### 2.5 FeasibilityAssessment

| 字段                     | 类型            | 必填 |
| ------------------------ | --------------- | ---- |
| `technical_feasibility`  | high/medium/low | 是   |
| `technical_risks`        | string[]        | 是   |
| `resource_estimation`    | string          | 是   |
| `timeline_estimation`    | string          | 是   |
| `dependencies`           | string[]        | 是   |
| `alternative_approaches` | string[]        | 是   |

### 2.6 RiskAnalysisResult

| 字段                 | 类型            | 必填 |
| -------------------- | --------------- | ---- |
| `risks`              | RiskItem[]      | 是   |
| `overall_risk_level` | high/medium/low | 是   |
| `critical_risks`     | string[]        | 是   |

RiskItem: `{id, category, description, probability, impact, mitigation, contingency}`

### 2.7 MVPPlan

| 字段              | 类型               | 必填 |
| ----------------- | ------------------ | ---- |
| `mvp_scope`       | RequirementPoint[] | 是   |
| `deferred_scope`  | RequirementPoint[] | 是   |
| `mvp_goal`        | string             | 是   |
| `success_metrics` | string[]           | 是   |
| `timeline`        | string             | 是   |
| `milestones`      | string[]           | 是   |

### 2.8 PlatformRecommendation

| 字段                   | 类型                       | 必填 |
| ---------------------- | -------------------------- | ---- |
| `recommended_platform` | web/mobile/desktop/cli/api | 是   |
| `tech_stack`           | object                     | 是   |
| `rationale`            | string                     | 是   |
| `alternatives`         | string[]                   | 是   |
| `trade_offs`           | string                     | 是   |

### 2.9 ProjectPlan

| 字段                    | 类型   | 必填 |
| ----------------------- | ------ | ---- |
| `phases`                | array  | 是   |
| `architecture_overview` | string | 是   |
| `component_tree`        | array  | 是   |
| `data_model`            | array  | 是   |
| `api_endpoints`         | array  | 是   |
| `development_guide`     | string | 是   |
| `ai_coding_prompt`      | string | 是   |

## 3. 枚举定义

| 枚举名              | 值                                                                                                                                                                                                                        |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WorkflowStage       | init, requirement_analysis, requirement_clarification, multi_model_analysis, requirement_synthesis, feasibility_analysis, risk_analysis, mvp_compression, platform_recommendation, planning_generation, completed, failed |
| ProjectStatus       | active, completed, failed                                                                                                                                                                                                 |
| StageStatus         | pending, running, completed, failed, skipped                                                                                                                                                                              |
| ExecutionStatus     | success, failed, timeout, cancelled                                                                                                                                                                                       |
| CallStatus          | success, failed, timeout, rate_limited                                                                                                                                                                                    |
| Priority            | P0, P1, P2, P3                                                                                                                                                                                                            |
| RequirementCategory | functional, non_functional, ux, business                                                                                                                                                                                  |
| RiskCategory        | technical, market, resource, schedule                                                                                                                                                                                     |
| Probability/Impact  | high, medium, low                                                                                                                                                                                                         |
| FeasibilityLevel    | high, medium, low                                                                                                                                                                                                         |
| PlatformType        | web, mobile, desktop, cli, api                                                                                                                                                                                            |
| ArtifactType        | requirement_report, feasibility_report, risk_report, mvp_plan, platform_recommendation, project_plan, prd, architecture, frontend_spec, backend_spec, ai_coding_rules                                                     |
| LLMProvider         | deepseek, glm, minimax                                                                                                                                                                                                    |

## 4. 版本兼容

- 字段不可删除（标记 deprecated）
- 新增字段必须可选
- 枚举值只增不减
- 类型不可变
