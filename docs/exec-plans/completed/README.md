# Completed Delivery Ledger

> Status: Historical Ledger<br>
> Last reviewed: 2026-08-28<br>
> Scope: 已完成复杂任务的目标、结果和验证摘要；当前行为以 Product、Architecture、Spec 和 Contract 为准。

详细执行过程由 Git 历史保存，不再为每次已完成任务长期保留独立计划文件。

## Deliveries

| 完成日期   | 交付内容                  | 结果摘要                                                                                       | 验证记录                                                |
| ---------- | ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 2026-07-18 | 工程约束与 Harness        | 建立架构、文档、配置、安全和代码形态机器门禁                                                   | `harness:check`、`verify`、Mock eval                    |
| 2026-07-22 | AI 生产安全加固           | 完成模型降级、SSE 边界、成本与 Docker 配置加固                                                 | LLM tests、API tests、Docker Harness                    |
| 2026-07-23 | 初始产品与质量闭环        | 完成规划工作流、Web UI、十一类产物、决策快照和质量报告                                         | unit、contract、integration、build、E2E                 |
| 2026-08-03 | 工作流测试加固            | 补齐数据隔离、错误恢复、HTTP 集成和关键用户路径                                                | `pnpm verify`、HTTP integration、Playwright             |
| 2026-08-03 | 项目知识与引用            | 完成文档索引、混合检索、引用快照和无证据降级                                                   | pgvector integration、Mock eval、三浏览器 E2E           |
| 2026-08-03 | 仓库知识与可恢复 Graph    | 完成 PDF、公开仓库、固定 commit 引用和 checkpoint 恢复                                         | parser/security、Graph integration、E2E                 |
| 2026-08-10 | 受控 Tool 与增量重生成    | 完成四个只读 Tool、脱敏轨迹和服务端影响范围计算                                                | contract/security、API/Web tests、E2E                   |
| 2026-08-10 | Docker 缓存与代码形态债务 | 优化依赖层缓存并清空代码形态豁免                                                               | format、lint、typecheck、tests、Harness                 |
| 2026-08-11 | 审查问题修复              | 完成 AUD-01 至 AUD-15 的并发、恢复、原子性、资源与安全边界修复                                 | 完整 CI、PostgreSQL HTTP、E2E、fallback、Docker         |
| 2026-08-28 | 白山按模型 API Key        | DeepSeek、GLM、MiniMax 各自使用独立 Adapter 与服务端 Key；拒绝部分真实配置                     | `verify:fast`、Key 映射回归、Chromium/Firefox E2E       |
| 2026-08-28 | 真实模型空结果恢复        | 空白模型响应受控失败；DeepSeek 预算 8192；free-text 不再跳过需求分析恢复；可读结果默认简体中文 | `verify:fast`、LLM/API 回归、Chrome 页面回归            |
| 2026-08-30 | 中文报告与调用成本展示    | 新生成报告统一使用简体中文；调用页人民币展示并显示脱敏工作说明，规划调用包含实际产物类型       | Prompt/API/Web 回归、`verify:fast`、Chrome 历史记录验证 |

## Audit Remediation

AUD-01 至 AUD-15 已全部完成：

- Graph 与 Tool 重放幂等、失败恢复、租约和并发 claim 已闭环。
- 知识 reindex、产物替换和增量重生成使用安全回退或事务边界。
- 限流容量、知识处理资源、密钥扫描、审计最小化和 CORS 边界已收紧。
- [`CI run 31478817902`](https://github.com/MARKX97/ai-software-planning-agent/actions/runs/31478817902) 通过 `pnpm verify`、PostgreSQL HTTP integration、Playwright E2E、两条 runner fallback 和 Docker smoke。

## Retention Rule

复杂任务完成后，将日期、交付内容、关键结果和验证证据追加到本台账，再删除 `active/` 中的详细计划。需要追溯实施过程时使用 Git 历史；不得把本台账当作当前产品或行为契约。
