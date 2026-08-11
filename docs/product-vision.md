# Product Vision

> Version: 3.2.0<br>
> Status: Current - Product Source of Truth<br>
> Last reviewed: 2026-08-12<br>
> Scope: 当前产品定位、用户、能力、边界和成功标准。

## 产品定位

AI Software Planning Agent 是一个**软件规划 Agent**，帮助用户把模糊的软件想法和已有项目资料收敛为可执行、可追溯的软件项目方案。

本产品不是代码生成工具，不自动修改代码或部署系统。

## 用户与目标

| 用户               | 核心目标                                     |
| ------------------ | -------------------------------------------- |
| 独立开发者         | 用有限时间和预算验证项目想法                 |
| AI Coding 用户     | 为 Codex、Claude Code、Cursor 提供开发上下文 |
| 创业者和产品负责人 | 明确用户、价值、风险、MVP 和技术路径         |

产品帮助用户回答：

1. 项目是否值得做。
2. 目标用户和核心问题是什么。
3. 主要风险与可行性如何。
4. MVP 应该包含和排除什么。
5. 适合什么平台和技术方案。
6. 如何形成可执行的开发计划。

## 当前用户流程

```text
创建项目
  → 上传 Markdown、TXT、PDF 或导入公开 GitHub 仓库
  → 查看知识源索引状态
  → 启动规划工作流
  → 完成需求范围、需求取舍、MVP 范围和技术方案四个检查点
  → 查看和下载带引用的规划产物
  → 知识变化后按影响范围增量重生成
```

用户可以在四个检查点与 Agent 实时、多轮讨论。确认时形成结构化决策快照；后续阶段使用已确认决定和当前活动会话，不重复注入全部历史消息。

## 当前能力

### 引导式规划工作流

- 需求分析与多轮澄清。
- DeepSeek、GLM 和 MiniMax 多模型并行分析与结果融合。
- 可行性分析、风险分析、MVP 收缩和平台推荐。
- 四个人工检查点，只有用户确认后才推进关键决策。
- 用户可见回复通过 SSE 实时展示，失败或取消不保存半条消息。

### 项目知识与证据

- 支持 Markdown、TXT、PDF 和公开 GitHub 仓库。
- 对文档和代码执行项目级混合检索，严格隔离不同项目。
- PDF 引用定位到页码；仓库引用定位到文件、行号和固定 commit。
- PRD 和 Architecture 使用 `[S1]` 形式引用实际提供给模型的证据。
- 来源删除或更新后，历史产物仍保留生成时的引用快照。
- 没有知识源或检索结果时继续完成工作流，并明确标记未使用项目证据。

### 受控 Agent 编排

- 使用可持久化的 Agent Graph 承载固定工作流、人工 interrupt 和失败恢复。
- 只允许 `searchKnowledge`、`readSource`、`inspectRepository` 和 `getArtifact` 四个只读 Tool。
- Tool 只能读取当前项目，不能写数据库、修改代码、改变权限或推进工作流。
- 每阶段最多执行 3 次 Tool 调用，并展示脱敏轨迹。
- 重放和恢复不得重复写入内部消息、产物、执行日志或成本汇总。

### 产物与质量闭环

系统生成：

- Requirement Report、Feasibility Report、Risk Report。
- MVP Plan、Platform Recommendation、Project Plan。
- PRD、Architecture、Frontend Spec、Backend Spec、AI Coding Rules。

每类产物执行确定性质量检查；机械性问题最多自动修订一次。部分产物仍未达到底线时保留成功结果并展示 warning，全部失败时工作流失败。

知识源变化后，服务端根据引用与产物依赖计算影响范围，只替换受影响产物；客户端不能扩大重生成范围。

## 成功标准

- 用户可以从项目想法和至少一种知识来源完成整个规划流程。
- 四个检查点、九个业务阶段和十一类产物保持可用。
- 有证据时引用与来源快照一致；无证据时不伪造引用。
- 工作流失败后可以从持久化状态恢复，重复恢复不产生重复内部副作用。
- 非白名单 Tool、跨项目读取、路径逃逸和来源中的 Prompt Injection 无法突破安全边界。
- 默认测试和 CI 使用 Mock LLM 与 Mock Embedding，保持确定性且不产生模型费用。

## 当前不包含

- Multi-Agent、Supervisor 或 Agent 间自主协作。
- 运行时 MCP、开放式 ReAct 和任意 Tool 注册。
- 私有仓库凭据、任意网页抓取、公开网页搜索和 OCR。
- 团队 RBAC、支付、跨组织知识共享。
- 自动修改代码、Auto Coding 和 Auto Deploy。
- 微服务、Redis、Kafka 或独立向量数据库。

## 产品演进摘要

| 版本 | 已交付能力                                                       |
| ---- | ---------------------------------------------------------------- |
| V1   | 从模糊想法到十一类规划产物的工作流、Web UI 和基础安全边界。      |
| V2   | 决策快照、受控上下文、产物质量闭环和 Prompt 版本追溯。           |
| V3   | 项目知识、混合检索、引用、可恢复 Graph、受控 Tool 和增量重生成。 |

具体行为与限制以 [`workflow.spec.md`](../specs/workflow.spec.md)、[`knowledge-base.spec.md`](../specs/knowledge-base.spec.md) 和 [`agent-graph.spec.md`](../specs/agent-graph.spec.md) 为准；历史交付摘要位于 [`Completed Delivery Ledger`](./exec-plans/completed/README.md)。
