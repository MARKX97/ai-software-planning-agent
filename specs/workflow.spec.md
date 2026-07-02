# Workflow State Machine — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: Backend Lead
> Tokens: ~5,000

---

## 1. 阶段定义

| # | 标识符 | 显示名称 | 说明 |
|---|--------|----------|------|
| 0 | `init` | 初始状态 | 项目创建后、工作流启动前 |
| 1 | `requirement_analysis` | 需求分析 | 单模型初步分析需求和用户画像 |
| 2 | `requirement_clarification` | 需求澄清 | 多轮对话澄清模糊需求（唯一循环点） |
| 3 | `multi_model_analysis` | 多模型分析 | 三模型并行独立分析 |
| 4 | `requirement_synthesis` | 需求融合 | 融合三模型结果 |
| 5 | `feasibility_analysis` | 可行性分析 | 技术可行性评估 |
| 6 | `risk_analysis` | 风险分析 | 风险识别与缓解 |
| 7 | `mvp_compression` | MVP 收缩 | MVP 范围裁剪 |
| 8 | `platform_recommendation` | 平台推荐 | 技术栈和平台推荐 |
| 9 | `planning_generation` | 规划生成 | 输出所有产物 |
| 10 | `completed` | 已完成 | 终态：工作流成功完成 |
| 11 | `failed` | 失败 | 终态：工作流异常终止 |

## 2. 项目生命周期状态

| 状态 | 说明 |
|------|------|
| `active` | 工作流执行中 |
| `completed` | 工作流成功完成 |
| `failed` | 工作流异常终止 |

## 3. 执行顺序

```
INIT
  → REQUIREMENT_ANALYSIS
  → REQUIREMENT_CLARIFICATION (可循环回 REQUIREMENT_ANALYSIS)
  → MULTI_MODEL_ANALYSIS
  → REQUIREMENT_SYNTHESIS
  → FEASIBILITY_ANALYSIS
  → RISK_ANALYSIS
  → MVP_COMPRESSION
  → PLATFORM_RECOMMENDATION
  → PLANNING_GENERATION
  → COMPLETED
```

## 4. 阶段详细说明

### 4.1 REQUIREMENT_ANALYSIS

| 属性 | 值 |
|------|-----|
| 触发 | `POST /run` |
| 模型 | DeepSeek（单模型） |
| 输入 | `project.original_idea` + 对话历史 |
| 输出 Schema | `RequirementAnalysisResult` |
| 输出存储 | `analysis_results` 表 |
| 超时 | 60s，重试最多 3 次 |

### 4.2 REQUIREMENT_CLARIFICATION

| 属性 | 值 |
|------|-----|
| 触发 | 自动（从 REQUIREMENT_ANALYSIS 进入） |
| 模型 | GLM（单模型） |
| 循环控制 | `MAX_CLARIFICATION_ROUNDS = 5` |
| 输出 | `{needs_more_clarification: bool, clarification_questions: [...]}` |

### 4.3 MULTI_MODEL_ANALYSIS

| 属性 | 值 |
|------|-----|
| 触发 | 自动 |
| 模型 | DeepSeek + GLM + MiniMax（并行） |
| 输出 Schema | `MultiModelAnalysisResult`（每模型独立） |
| 降级 | 至少 1 个模型成功即可继续 |

### 4.4 REQUIREMENT_SYNTHESIS

| 属性 | 值 |
|------|-----|
| 模型 | DeepSeek |
| 输入 | 三个模型分析结果（共性+冲突+独特洞察） |
| 输出 Schema | `SynthesizedRequirement` |

### 4.5 FEASIBILITY_ANALYSIS

| 属性 | 值 |
|------|-----|
| 模型 | GLM |
| 输出 Schema | `FeasibilityAssessment` |

### 4.6 RISK_ANALYSIS

| 属性 | 值 |
|------|-----|
| 模型 | DeepSeek |
| 输出 Schema | `RiskAnalysisResult` |

### 4.7 MVP_COMPRESSION

| 属性 | 值 |
|------|-----|
| 模型 | DeepSeek |
| 输出 Schema | `MVPPlan` |

### 4.8 PLATFORM_RECOMMENDATION

| 属性 | 值 |
|------|-----|
| 模型 | GLM |
| 输出 Schema | `PlatformRecommendation` |

### 4.9 PLANNING_GENERATION

| 属性 | 值 |
|------|-----|
| 模型 | DeepSeek（PRD/Architecture）+ GLM（其余） |
| 输出 | 11 类产物（Markdown 文件） |

## 5. 状态转换规则

### 5.1 转换矩阵

```
FROM                        →  TO                        条件
───────────────────────────────────────────────────────────────────
INIT                        →  REQUIREMENT_ANALYSIS       start_workflow
REQUIREMENT_ANALYSIS        →  REQUIREMENT_CLARIFICATION  自动
REQUIREMENT_ANALYSIS        →  FAILED                     不可恢复错误
REQUIREMENT_CLARIFICATION   →  REQUIREMENT_ANALYSIS       needs_more_clarification=true
REQUIREMENT_CLARIFICATION   →  MULTI_MODEL_ANALYSIS       needs_more_clarification=false
REQUIREMENT_CLARIFICATION   →  FAILED                     不可恢复错误
MULTI_MODEL_ANALYSIS        →  REQUIREMENT_SYNTHESIS      至少 1 模型成功
MULTI_MODEL_ANALYSIS        →  FAILED                     0/3 模型成功
REQUIREMENT_SYNTHESIS       →  FEASIBILITY_ANALYSIS       自动
REQUIREMENT_SYNTHESIS       →  FAILED                     不可恢复错误
FEASIBILITY_ANALYSIS        →  RISK_ANALYSIS               自动
FEASIBILITY_ANALYSIS        →  FAILED                     不可恢复错误
RISK_ANALYSIS               →  MVP_COMPRESSION             自动
RISK_ANALYSIS               →  FAILED                     不可恢复错误
MVP_COMPRESSION             →  PLATFORM_RECOMMENDATION     自动
MVP_COMPRESSION             →  FAILED                     不可恢复错误
PLATFORM_RECOMMENDATION     →  PLANNING_GENERATION         自动
PLATFORM_RECOMMENDATION     →  FAILED                     不可恢复错误
PLANNING_GENERATION         →  COMPLETED                   自动
PLANNING_GENERATION         →  FAILED                     不可恢复错误
COMPLETED                   →  (终态)
FAILED                      →  (终态)
```

### 5.2 降级路径

```
MULTI_MODEL_ANALYSIS:
  3/3 成功 → 正常
  2/3 成功 → 降级（WARNING）
  1/3 成功 → 严重降级（WARNING）
  0/3 成功 → FAILED

Schema 校验失败:
  第 1 次 → 重试
  第 2 次 → 降级为自由文本，继续

LLM 超时:
  1s → 2s → 4s 退避，3 次后 FAILED
```

## 6. 版本兼容

- 阶段标识符不可重命名、不可删除
- v1.0.x: 阶段不变
- v1.x.0: 可新增阶段
- v2.0.0: 允许破坏性变更
