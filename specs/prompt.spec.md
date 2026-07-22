# Prompt Management — System Contract

> Version: 1.2.0
> Status: Contract
> Owner: AI Infrastructure Lead
> Tokens: ~2,000

---

## 1. Prompt 模板清单

| 文件名                              | 用途                     | 变量                                                                          |
| ----------------------------------- | ------------------------ | ----------------------------------------------------------------------------- |
| `requirement-analysis.prompt.ts`    | 需求分析                 | `{{idea}}`, `{{conversationHistory}}`                                         |
| `clarification.prompt.ts`           | 需求澄清自然语言回复     | `{{questions}}`, `{{conversationHistory}}`, `{{clarificationRound}}`          |
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
| 需求澄清   | `clarification.prompt.ts`           | `CLARIFICATION_PROMPT`           |
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

### 2.5 不可信上下文

- `renderPrompt()` 为所有 Prompt 添加统一安全前言，并把每个插值值放入带变量名的 `<untrusted-context>` 边界。
- 插值内容中的边界关闭标签必须转义；高置信度 API Key、Token、Secret、Password 赋值必须脱敏。
- 项目想法和对话消息在 API 输入边界拒绝高置信度密钥，避免原始密钥进入数据库、Prompt 和模型调用日志。
- 上述措施降低 Prompt Injection 和密钥误传风险，但不宣称可以绝对阻止模型越权；工作流推进、数据库写入和权限判断继续由确定性应用代码完成。

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

| 应用层动作   | 当前实现                                                               | 触发依据                       |
| ------------ | ---------------------------------------------------------------------- | ------------------------------ |
| 识别澄清问题 | Requirement Analysis 返回包含 `question/context/category` 的结构化问题 | 输出 Schema 与澄清状态         |
| 组织对话回复 | Clarification/Checkpoint Discussion Prompt 返回纯文本，通过 SSE 展示   | 未解决问题与当前检查点上下文   |
| 推进阶段     | Workflow 状态机校验并推进                                              | 阶段结果、检查点状态与用户确认 |
| 保存产物     | Artifact 生成流程校验结果后持久化                                      | 固定产物类型与生成结果         |
| 记录错误     | Adapter、Orchestrator 与 Workflow 统一映射并记录                       | 运行时异常与执行状态           |

仅当后续需求要求模型根据上下文动态选择外部能力，并需要把执行结果回传模型继续推理时，
才新增 Function Calling / Tool Use 契约。状态推进、权限校验和数据库写入仍不得由模型直接控制。

用户可见的对话 Prompt 不得要求 `{ "reply": "..." }` 等 JSON 外壳；内部分析、融合和产物生成继续使用结构化输出。

## 5. Prompt 版本管理

- 所有 Prompt 变更走 Git PR
- 变更后更新 prompt-regression 快照测试
- 每个可调用 Prompt 在 `prompt_versions` 中保留版本和源码 SHA-256；同一版本不可覆盖 hash。
- `model_execution_logs.prompt_version_id` 按实际 Prompt 名称关联最新已登记版本；找不到版本时允许为空，但模型调用不得因此失败。
- 需求澄清和检查点讨论分别使用 `requirement_clarification`、`checkpoint_discussion`，不能仅用工作流阶段名代替实际 Prompt 名称。
