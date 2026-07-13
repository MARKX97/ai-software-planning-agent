# Prompt Management — System Contract

> Version: 1.0.1
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

## 4. LLM 交互边界

MVP 不使用模型原生 Function Calling / Tool Use。Provider 请求不发送 `tools`、`tool_choice`，
Orchestrator 不执行 Tool Call 循环。模型只负责生成文本和结构化输出，工作流推进、数据写入与
错误处理由应用层确定性执行。

模型配置中的 `function_calling` 仅表示 Provider 具备该能力，不表示本项目已启用。

| 应用层动作   | 当前实现                                                                      | 触发依据                       |
| ------------ | ----------------------------------------------------------------------------- | ------------------------------ |
| 提出澄清问题 | LLM 返回结构化 `clarification_questions`，Workflow Service 保存并等待用户回复 | 输出 Schema 与澄清状态         |
| 推进阶段     | Workflow 状态机校验并推进                                                     | 阶段结果、检查点状态与用户确认 |
| 保存产物     | Artifact 生成流程校验结果后持久化                                             | 固定产物类型与生成结果         |
| 记录错误     | Adapter、Orchestrator 与 Workflow 统一映射并记录                              | 运行时异常与执行状态           |

仅当后续需求要求模型根据上下文动态选择外部能力，并需要把执行结果回传模型继续推理时，
才新增 Function Calling / Tool Use 契约。状态推进、权限校验和数据库写入仍不得由模型直接控制。

## 5. Prompt 版本管理

- 所有 Prompt 变更走 Git PR
- 变更后更新 prompt-regression 快照测试
- 重大变更记录到 `prompt_versions` 表
