# V2 Controlled Quality Loop

> Status: Completed

## Goal

把现有单工作流 Agent 从“能完成规划”提升为“按已确认结论规划、能解释产物底线、可以追溯 Prompt 版本”的第二版。

## Acceptance Criteria

- 四个人工检查点确认时持久化结构化决策快照，刷新后仍可恢复。
- 模型上下文只包含结构化已确认决策和当前会话，并受固定字符预算限制。
- 11 类规划产物执行确定性质量检查；机械性失败最多自动修订一次。
- `workflow/status` 和工作流页面展示决策快照及最终质量报告。
- 模型调用日志尽可能关联已有 PromptVersion，不存在匹配版本时安全降级为空。
- Mock 评测覆盖快照、上下文边界、质量检查与修订上限。
- `pnpm verify:fast` 通过。

## Decisions

- 复用 `Message.metadata` 和 `WorkflowState.data_json`，不新增数据库表或迁移。
- 不新增依赖、Agent、RAG、MCP、LLM Judge 或后台任务。
- 决策摘要从既有结构化阶段结果和用户反馈确定性提取，不为摘要增加模型费用。
- 质量规则只处理可客观判断的机械性问题；业务取舍继续由人工检查点负责。

## Contract Impact

- `WorkflowStatusResponse` 新增 `decision_snapshots` 和可空 `quality_report`。
- `WorkflowContext` 新增结构化 `confirmedDecisions`。
- `planning_generation` 阶段结果新增 `quality_report`。
- `model_execution_logs.prompt_version_id` 开始关联已有种子版本。

## Progress

- [x] 完成 V2 范围、约束和验收标准。
- [x] 更新机器契约和共享 Schema。
- [x] 实现决策快照与受控上下文。
- [x] 实现产物质量检查、单次修订和 Prompt 版本关联。
- [x] 展示决策与质量状态。
- [x] 补充评测并完成验证。

## Validation

- `pnpm verify:fast`：通过。
- `pnpm verify`：通过，包括格式、Harness、lint、typecheck、全仓测试和生产构建。
- 默认验证未调用真实白山模型；付费 smoke test 和 PostgreSQL HTTP 集成测试按项目约定保持跳过。
