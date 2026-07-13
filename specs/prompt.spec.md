# Prompt Management — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: AI Infrastructure Lead
> Tokens: ~2,000

---

## 1. Prompt 模板清单

| 文件名                              | 用途                     | 变量                                                                          |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `requirement-analysis.prompt.ts`    | 需求分析                 | `{{idea}}`, `{{conversationHistory}}`                                         |
| `multi-model-analysis.prompt.ts`    | 多模型分析（3 模型共用） | `{{requirement}}`                                                             |
| `synthesis.prompt.ts`               | 需求融合                 | `{{originalIdea}}`, `{{commonPoints}}`, `{{conflicts}}`, `{{uniqueInsights}}` |
| `checkpoint-discussion.prompt.ts`   | 检查点讨论               | `{{checkpointName}}`, `{{checkpointResult}}`, `{{conversationHistory}}`       |
| `feasibility-analysis.prompt.ts`    | 可行性分析               | `{{requirement}}`, `{{conversationHistory}}`                                  |
| `risk-analysis.prompt.ts`           | 风险分析                 | `{{requirement}}`, `{{feasibility}}`, `{{conversationHistory}}`               |
| `mvp-compression.prompt.ts`         | MVP 收缩                 | `{{requirement}}`, `{{risks}}`, `{{feasibility}}`, `{{conversationHistory}}`  |
| `platform-recommendation.prompt.ts` | 平台推荐                 | `{{mvp}}`, `{{requirement}}`, `{{conversationHistory}}`                       |
| `planning-generation.prompt.ts`     | 规划生成（11 产物共用）  | `{{context}}`, `{{artifactType}}`                                             |

## 2. Prompt 规范

### 2.1 存放位置

```
apps/api/src/prompts/<name>.prompt.ts
```

### 2.2 命名规范

| 阶段       | 文件名                              | 导出常量                         |
| ---------- | ----------------------------------- | -------------------------------- |
| 需求分析   | `requirement-analysis.prompt.ts`    | `REQUIREMENT_ANALYSIS_PROMPT`    |
| 多模型分析 | `multi-model-analysis.prompt.ts`    | `MULTI_MODEL_ANALYSIS_PROMPT`    |
| 需求融合   | `synthesis.prompt.ts`               | `SYNTHESIS_PROMPT`               |
| 检查点讨论 | `checkpoint-discussion.prompt.ts`   | `CHECKPOINT_DISCUSSION_PROMPT`   |
| 可行性分析 | `feasibility-analysis.prompt.ts`    | `FEASIBILITY_ANALYSIS_PROMPT`    |
| 风险分析   | `risk-analysis.prompt.ts`           | `RISK_ANALYSIS_PROMPT`           |
| MVP 收缩   | `mvp-compression.prompt.ts`         | `MVP_COMPRESSION_PROMPT`         |
| 平台推荐   | `platform-recommendation.prompt.ts` | `PLATFORM_RECOMMENDATION_PROMPT` |
| 规划生成   | `planning-generation.prompt.ts`     | `PLANNING_GENERATION_PROMPT`     |

### 2.3 变量注入

```
✅ 使用 {{variable}} 占位符 + .replace()
❌ 字符串拼接
❌ 条件逻辑
```

### 2.4 禁止事项

```
❌ 在阶段处理器中硬编码 Prompt 字符串
❌ 在 Service 中拼接 Prompt
❌ 将 Prompt 放在环境变量中
❌ 将 Prompt 放在数据库中
✅ 集中在 apps/api/src/prompts/ 目录
```

## 3. Structured Output Schema 映射

| 阶段                    | Schema 文件                                          |
| ----------------------- | ---------------------------------------------------- |
| requirement_analysis    | `contracts/schemas/llm/requirement-analysis.json`    |
| multi_model_analysis    | `contracts/schemas/llm/multi-model-analysis.json`    |
| requirement_synthesis   | `contracts/schemas/llm/synthesized-requirement.json` |
| feasibility_analysis    | `contracts/schemas/llm/feasibility-assessment.json`  |
| risk_analysis           | `contracts/schemas/llm/risk-analysis.json`           |
| mvp_compression         | `contracts/schemas/llm/mvp-plan.json`                |
| platform_recommendation | `contracts/schemas/llm/platform-recommendation.json` |
| planning_generation     | `contracts/schemas/llm/project-plan.json`            |

## 4. Function Calling 定义

| Function                     | 用途       | 场景     |
| ---------------------------- | ---------- | -------- |
| `ask_clarification_question` | 向用户提问 | 澄清阶段 |
| `advance_stage`              | 推进状态   | 阶段完成 |
| `save_artifact`              | 保存产物   | 规划生成 |
| `report_error`               | 报告错误   | 异常处理 |

## 5. Function Calling 分类

| 类别     | 值       |
| -------- | -------- |
| user     | 用户相关 |
| scope    | 范围相关 |
| tech     | 技术相关 |
| business | 业务相关 |
| risk     | 风险相关 |

## 6. Prompt 版本管理

- 所有 Prompt 变更走 Git PR
- 变更后更新 prompt-regression 快照测试
- 重大变更记录到 `prompt_versions` 表
