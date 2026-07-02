# Model Routing — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: AI Infrastructure Lead
> Tokens: ~2,000

---

## 1. 阶段模型路由

| 阶段                      | 调用方式        | 模型                                             | 理由                |
| ------------------------- | --------------- | ------------------------------------------------ | ------------------- |
| requirement_analysis      | callSingle      | **deepseek**                                     | 高质量分析          |
| requirement_clarification | callSingle      | **glm**                                          | 对话交互，性价比    |
| multi_model_analysis      | callMulti       | **全部 3 模型**                                  | 核心价值：多视角    |
| requirement_synthesis     | callSingle      | **deepseek**                                     | 强推理              |
| feasibility_analysis      | callSingle      | **glm**                                          | 性价比              |
| risk_analysis             | callSingle      | **deepseek**                                     | 强判断力            |
| mvp_compression           | callSingle      | **deepseek**                                     | 强判断力            |
| platform_recommendation   | callSingle      | **glm**                                          | 性价比              |
| planning_generation       | callSingle × 11 | **deepseek** (PRD/Architecture) + **glm** (其余) | 核心产物用 DeepSeek |

## 2. 产物级模型路由

| 产物                    | 模型         |
| ----------------------- | ------------ |
| requirement_report      | glm          |
| feasibility_report      | glm          |
| risk_report             | glm          |
| mvp_plan                | glm          |
| platform_recommendation | glm          |
| prd                     | **deepseek** |
| architecture            | **deepseek** |
| frontend_spec           | glm          |
| backend_spec            | glm          |
| project_plan            | glm          |
| ai_coding_rules         | glm          |

## 3. 模型定价

| 模型            | 输入 (¥/1K) | 输出 (¥/1K) |
| --------------- | ----------- | ----------- |
| DeepSeek-V4-Pro | 0.002       | 0.008       |
| GLM-5.1         | 0.001       | 0.001       |
| MiniMax-M2.5    | 0.001       | 0.001       |

## 4. 路由原则

```
1. 多模型并行仅在 multi_model_analysis 阶段使用
2. DeepSeek: 核心分析任务（需求分析/融合/风险/MVP）+ 核心产物（PRD/Architecture）
3. GLM: 辅助任务（澄清/可行性/平台推荐）+ 辅助产物
4. MiniMax: 多模型分析中提供第三方视角
5. 避免所有阶段都调用 3 个模型
```

## 5. 成本对比

| 策略                   | 单项目成本 | 说明                        |
| ---------------------- | ---------- | --------------------------- |
| 全 3 模型              | ¥0.459     | 所有阶段并行 3 模型         |
| 全 DeepSeek            | ¥0.135     | 所有阶段单模型              |
| **按任务路由（推荐）** | **¥0.167** | 核心用 DeepSeek，辅助用 GLM |
| vs 全 3 模型节省       | **64%**    |                             |
