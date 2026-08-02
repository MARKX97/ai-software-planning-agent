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

1. 用户创建项目并上传 Markdown、TXT；后续优先级再开放 PDF 和公开 GitHub 仓库。
2. 系统解析、切片并索引内容，展示每个知识源的处理状态和失败原因。
3. 工作流先按固定策略检索相关证据；后续再开放受控的检索、来源读取、仓库检查和前序产物 Tool。
4. PRD、Architecture 等产物以 `[S1]` 形式引用来源，用户可查看文件、章节、代码路径、commit 和原文片段。
5. 证据不足或相互冲突时，工作流进入现有人工检查点；用户确认后才继续。
6. 执行失败可从最近 Graph checkpoint 恢复；知识源变化后只重新生成受影响的阶段和产物。

### V3 功能优先级

#### P0：最小证据闭环

**目的：** 先解除架构、依赖和机器契约阻塞，再让用户能够用自己的文档生成可追溯产物；P0 不依赖 LangGraph。

**功能：**

- 先更新 Harness 中 P0 所需的 LangChain、`pgvector` 白名单，以及 OpenAPI、共享 Zod Schema、数据库规格和 Prisma migration，再实现代码。
- 支持 Markdown、TXT 上传、状态查看、重新索引和删除；建立稳定 Chunk、Mock Embedding 与 active revision。
- 使用 PostgreSQL `pgvector` 与全文检索完成项目级混合检索，按固定阶段策略注入证据。
- 关键结论生成 `[S1]` 引用并保留快照；无知识源或无结果时降级到 V2，并显示证据限制。
- 提供最小知识源管理和产物引用查看入口。

**完成判定 / 退出条件：**

- 至少一种文档能从上传完整流转到带引用产物，索引状态和失败原因对用户可见。
- 检索严格按 `project_id` 和 active revision 过滤，跨项目隔离、引用一致性和历史快照测试通过。
- 关闭 RAG feature flag 或没有知识源时，V2 工作流、四个检查点和 11 类产物保持可用。
- 默认测试仅使用 Mock Embedding 和 Mock LLM；Harness、类型检查、数据库集成测试和核心 Eval 通过。

#### P1：代码感知与可恢复编排

**目的：** 扩大可用知识范围，并在 P0 证据闭环稳定后把现有确定性工作流迁移到可恢复的 LangGraph。

**功能：**

- 增加 PDF 与公开 GitHub 仓库导入，固定 commit SHA，并识别目录、依赖、接口和数据结构。
- 基于仓库证据生成增量改造方案和影响范围。
- 将现有 9 个阶段、四个人工检查点和固定检索步骤映射为 LangGraph Node、Edge、interrupt 与持久化 checkpoint。
- 在引入 LangGraph 依赖前更新对应 Harness 白名单；该迁移与 PDF、公开仓库导入可在 P0 退出条件通过后并行推进。
- 展示 Graph 当前节点、恢复状态和脱敏执行轨迹。

**完成判定 / 退出条件：**

- 用户可以导入 PDF 和公开仓库，并从代码来源生成可定位到文件、行号和 commit 的引用。
- 进程重启后能从最近 checkpoint 恢复，重复 resume 不会重复写入消息、产物、执行日志或成本。
- V2 阶段顺序、SSE、检查点和产物回归通过；迁移期可以通过 feature flag 切回 V2 runner。

P0 与 P1 完成后达到 V3 首次发布条件。

#### P2：受控动态 Tool 与增量重生成

**目的：** 在检索质量和 Graph 恢复机制稳定后，提高复杂项目中的自主取证效率，不扩大 Agent 权限。

**功能：**

- 开放 `searchKnowledge`、`readSource`、`inspectRepository`、`getArtifact` 的结构化 Action 选择。
- 强制 Tool 白名单、Zod 参数校验、项目 ID 服务端覆盖、单阶段 3 次上限和审计日志。
- 知识源变化后，依据来源与产物关系提示并重新生成受影响阶段；补充完整 Tool 轨迹界面。

**完成判定 / 退出条件：**

- 非白名单 Tool、伪造项目 ID、路径穿越、Prompt Injection 和第四次调用均被拒绝。
- Tool 失败按规格降级或进入人工检查点，不执行来源中的自由文本指令。
- 增量重生成不修改未受影响产物，Graph 重放继续满足幂等与成本上限。

### V3 不包含

- Multi-Agent、Supervisor 或 Agent 间自主协作。
- 公开网页搜索、网页抓取和通用联网研究。
- 私有仓库 OAuth、团队 RBAC 和跨组织知识共享。
- 运行时 MCP、自动修改代码、Auto Deploy 和无限制反思循环。
- Pinecone、Qdrant、Weaviate 等独立向量数据库。

行为与实现边界见 `specs/knowledge-base.spec.md`、`specs/agent-graph.spec.md`；当前代码仍为 V2，V3 状态为 Planned。
