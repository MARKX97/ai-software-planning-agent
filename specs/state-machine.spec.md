# State Machine — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: Backend Lead
> Tokens: ~2,000

---

## 1. 状态机类型

确定性有限状态机 (Deterministic Finite State Machine)
- 状态数: 12
- 转换边: 17
- 循环: 1（澄清循环）
- 终态: 2（COMPLETED, FAILED）

## 2. 阶段状态

| 状态 | 说明 |
|------|------|
| `pending` | 等待执行 |
| `running` | 执行中 |
| `completed` | 执行成功 |
| `failed` | 执行失败 |
| `skipped` | 已跳过 |

## 3. 执行状态

| 状态 | 说明 |
|------|------|
| `success` | 执行成功 |
| `failed` | 执行失败（不可恢复） |
| `timeout` | 执行超时 |
| `cancelled` | 用户取消 |

## 4. VALID_TRANSITIONS 矩阵

```
INIT                        → { REQUIREMENT_ANALYSIS }
REQUIREMENT_ANALYSIS        → { REQUIREMENT_CLARIFICATION, FAILED }
REQUIREMENT_CLARIFICATION   → { REQUIREMENT_ANALYSIS, MULTI_MODEL_ANALYSIS, FAILED }
MULTI_MODEL_ANALYSIS        → { REQUIREMENT_SYNTHESIS, FAILED }
REQUIREMENT_SYNTHESIS       → { FEASIBILITY_ANALYSIS, FAILED }
FEASIBILITY_ANALYSIS        → { RISK_ANALYSIS, FAILED }
RISK_ANALYSIS               → { MVP_COMPRESSION, FAILED }
MVP_COMPRESSION             → { PLATFORM_RECOMMENDATION, FAILED }
PLATFORM_RECOMMENDATION     → { PLANNING_GENERATION, FAILED }
PLANNING_GENERATION         → { COMPLETED, FAILED }
COMPLETED                   → { }
FAILED                      → { }
```

## 5. 进度计算

| 阶段 | completed_stages | percentage |
|------|-----------------|------------|
| init | 0 | 0% |
| requirement_analysis | 0 | 0% |
| requirement_clarification | 1 | 11.1% |
| multi_model_analysis | 2 | 22.2% |
| requirement_synthesis | 3 | 33.3% |
| feasibility_analysis | 4 | 44.4% |
| risk_analysis | 5 | 55.6% |
| mvp_compression | 6 | 66.7% |
| platform_recommendation | 7 | 77.8% |
| planning_generation | 8 | 88.9% |
| completed | 9 | 100% |

## 6. 阶段顺序

```
1. requirement_analysis
2. requirement_clarification
3. multi_model_analysis
4. requirement_synthesis
5. feasibility_analysis
6. risk_analysis
7. mvp_compression
8. platform_recommendation
9. planning_generation
```

## 7. 事件与副作用

| 事件 | 副作用 |
|------|--------|
| `on_enter_stage` | 更新 `project.current_stage`、`project.updated_at` |
| `on_exit_stage` | 保存 `analysis_results` 记录 |
| `on_exit_synthesis` | 更新 `project.requirement_text` |
| `on_exit_planning` | 保存所有产物到 `artifacts` 表 + 文件系统 |
