# Product Vision

> Version: 3.0.0
> Status: Product Source of Truth

---

## 版本边界

| 产品版本 | 状态    | 定义                                                                           |
| -------- | ------- | ------------------------------------------------------------------------------ |
| V1       | 已交付  | 完成从模糊想法到 11 类规划产物的主工作流、Web UI 和生产安全基础。              |
| V2       | 已交付  | 在 V1 之上增加决策快照、受控上下文、产物质量闭环和 Prompt 版本追溯。           |
| V3       | Planned | 引入项目知识库、证据引用和受控 Agent Graph，使规划基于用户真实文档与代码仓库。 |

## 产品定位

AI Software Planning Agent 是一个**软件规划 Agent**，帮助用户将模糊的软件想法逐步收敛为可执行的软件项目方案。

**本产品不是代码生成工具。**

## 核心目标

帮助用户回答：

1. 这个项目值得做吗
2. 用户是谁
3. 风险是什么
4. MVP 是什么
5. 应该做成什么平台
6. 如何开始开发

## 用户类型

### 独立开发者

- 特点：时间有限、预算有限
- 目标：快速验证项目想法

### AI Coding 用户

- 特点：使用 Claude Code / Cursor / Codex
- 目标：获得高质量开发上下文

### 创业者

- 目标：验证商业想法

## 核心流程

```
Idea → Requirement Analysis → Requirement Clarification
→ Multi Model Analysis → Requirement Synthesis
→ Feasibility Analysis → Risk Analysis → MVP Compression
→ Platform Recommendation → Planning Generation
```

需求澄清、需求范围、MVP 取舍和技术方案是用户可参与的检查点。用户可在每个检查点与 Agent 实时、多轮讨论，边生成边阅读，确认后才推进到下一环节；讨论结论会进入后续分析和最终规划。

## 多模型分析

多模型分析阶段默认使用 GLM-4.5 / DeepSeek-R1-0528 / MiniMax-M2.5 三个模型并行分析；具体模型 ID 由环境变量配置，并以白山控制台可用列表为准。

## 输出内容

- Requirement Report, Feasibility Report, Risk Report
- MVP Plan, Platform Recommendation, Project Plan
- PRD, Architecture, Frontend Spec, Backend Spec, AI Coding Rules

## V1：首版交付范围

### V1 支持

- 实时多轮需求沟通与关键检查点确认
- 多模型分析
- 需求融合
- 风险分析
- MVP 收缩
- 平台推荐
- 项目规划生成
- Web UI（创建项目、工作流进度、检查点讨论、产物查看与导出）

### V1 不支持

- RAG, MCP, Auto Coding, Auto Deploy, Multi-Agent
- 用户系统、RBAC、支付系统

## V2：让规划结果可控、可验、可追溯

V2 不增加新的 Agent 数量，而是提高现有单工作流 Agent 的工程质量：

- 用户确认检查点时形成结构化“决策快照”，后续阶段只使用已确认决策和当前对话，不再重复注入全部历史消息。
- 11 类规划产物生成后执行确定性质量检查；机械性问题最多自动修订一次，并输出可见的质量报告。
- 工作流状态展示已确认决策和最终质量结果，用户能知道“系统按什么结论继续”以及“产物是否达到交付底线”。
- 模型调用日志关联已有 PromptVersion，支持按 Prompt 版本追溯结果和成本。
- 默认评测增加决策继承、上下文边界、产物覆盖和质量报告断言，继续保持 Mock、确定性和零模型费用。

### V2 仍不支持

- 运行时 Multi-Agent、RAG、MCP、向量数据库和 Agent 框架。
- 使用 LLM-as-a-Judge 作为发布门禁；确定性规则不足以判断业务质量时，由用户检查点确认。
- 无限制的自动反思或重试；单个产物最多额外修订一次。

## V3：基于项目证据的受控规划 Agent（Planned）

V3 解决 V2 只能依赖项目想法、对话和阶段结果，无法系统读取现有文档与代码的问题。V3 不改变“软件规划而非代码生成”的产品定位。

### V3 用户流程

1. 用户创建项目并上传 Markdown、TXT、PDF，或导入公开 GitHub 仓库。
2. 系统解析、切片并索引内容，展示每个知识源的处理状态和失败原因。
3. 工作流按阶段检索相关证据；Agent 可受控调用检索、读取来源、仓库检查和前序产物工具。
4. PRD、Architecture 等产物以 `[S1]` 形式引用来源，用户可查看文件、章节、代码路径、commit 和原文片段。
5. 证据不足或相互冲突时，工作流进入现有人工检查点；用户确认后才继续。
6. 执行失败可从最近 Graph checkpoint 恢复；知识源变化后只重新生成受影响的阶段和产物。

### V3 MVP 功能

- 项目级知识库：上传、公开仓库导入、状态查看、重新索引和删除。
- 混合检索：语义检索与 PostgreSQL 全文检索融合，并强制按项目隔离。
- 证据化产物：关键结论携带可追溯引用，无证据时显式标记限制。
- 代码感知规划：识别目录、依赖、接口和数据结构，输出增量改造与影响范围。
- 单 Agent 工具编排：工具白名单、结构化参数、调用上限和审计日志。
- 持久化 Graph：条件分支、人工 interrupt、失败恢复和执行轨迹。

### V3 验收标准

- 用户可以导入至少一种文档和一个公开 GitHub 仓库，并看到可解释的索引状态。
- 检索结果不会跨项目泄漏，引用能够定位到生成时使用的内容快照。
- 没有知识源时，现有 V2 工作流仍可运行且结果明确标记为未使用项目证据。
- 单阶段工具调用不超过 3 次，Graph 重放不会重复写入消息、产物或成本。
- 四个人工检查点继续生效，进程重启后可恢复到最近持久化 checkpoint。
- 默认测试使用 Mock Embedding 和 Mock LLM，不产生外部调用费用。

### V3 不包含

- Multi-Agent、Supervisor 或 Agent 间自主协作。
- 公开网页搜索、网页抓取和通用联网研究。
- 私有仓库 OAuth、团队 RBAC 和跨组织知识共享。
- 运行时 MCP、自动修改代码、Auto Deploy 和无限制反思循环。
- Pinecone、Qdrant、Weaviate 等独立向量数据库。

行为与实现边界见 `specs/knowledge-base.spec.md`、`specs/agent-graph.spec.md`；当前代码仍为 V2，V3 状态为 Planned。
