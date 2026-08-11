# System Design

> Version: 1.5.0<br>
> Status: Current<br>
> Last reviewed: 2026-08-12<br>
> Scope: 当前端到端执行、知识索引、恢复和核心数据关系。

本文档只展示系统数据流。模块职责见 [`architecture-overview.md`](./architecture-overview.md)，详细行为见 [`workflow.spec.md`](../specs/workflow.spec.md)、[`knowledge-base.spec.md`](../specs/knowledge-base.spec.md) 和 [`agent-graph.spec.md`](../specs/agent-graph.spec.md)。

## 运行时主链路

```mermaid
flowchart LR
  user["用户 / Browser"]

  subgraph api["NestJS API Server"]
    admission["认证、限流、参数校验、成本准入"]
    workflow["Workflow Service"]
    agentGraph["LangGraph<br/>checkpoint / interrupt / resume"]
    tools["受控只读 Tools<br/>单阶段最多 3 次"]
    retriever["Knowledge Retrieval<br/>Vector + FTS + RRF"]
    stages["Stage Executor<br/>9 个阶段 / 4 个检查点"]
    orchestrator["LlmOrchestratorService<br/>路由、重试、降级"]
    stream["SSE<br/>delta / done / error"]
  end

  subgraph llm["LLM Infrastructure"]
    provider["Provider"]
    adapter["OpenAI-compatible Adapter"]
    baishan["Baishan API"]
  end

  database[("PostgreSQL + pgvector<br/>业务数据、知识索引、Graph checkpoint")]
  files["Artifact Files"]

  user -->|"HTTP / SSE"| admission --> workflow --> agentGraph
  agentGraph -->|"固定检索"| retriever
  agentGraph -. "结构化 Action" .-> tools --> retriever
  retriever -->|"EvidenceCitation[]"| agentGraph --> stages
  stages --> orchestrator --> provider --> adapter --> baishan
  baishan --> adapter --> provider --> orchestrator --> stages
  stages --> stream --> user
  agentGraph --> database
  stages --> database
  stages --> files
```

所有 Chat LLM 调用只经过 `LlmOrchestratorService`。没有知识源、没有检索结果或关闭知识检索时，工作流沿用无证据路径并明确标记限制。

## 规划工作流

```mermaid
flowchart TD
  start["创建项目"] --> requirement["需求分析"] --> clarification["需求澄清"]
  clarification -->|"仍需信息，最多 5 轮"| requirement
  clarification --> cp1["检查点：需求范围"]
  cp1 --> multi["多模型分析"] --> synthesis["需求融合"] --> cp2["检查点：需求取舍"]
  cp2 --> feasibility["可行性分析"] --> risk["风险分析"] --> mvp["MVP 收缩"] --> cp3["检查点：MVP 范围"]
  cp3 --> platform["平台推荐"] --> cp4["检查点：技术方案"] --> planning["规划生成"] --> done["完成"]
```

检查点讨论通过 SSE 返回。用户确认时保存结构化决策快照；后续阶段只接收已确认决定和当前活动会话的受限上下文。

## 知识索引与引用

```mermaid
flowchart LR
  sources["Markdown / TXT / PDF<br/>公开 GitHub 仓库"]
  validate["类型、大小、域名和安全校验"]
  parse["解析与规范化"]
  split["确定性切片<br/>hash + locator"]
  embed["独立 Embedding Provider"]
  revision["新 Revision"]
  chunks[("Chunk<br/>FTS + pgvector")]
  activate["原子切换 Active Revision"]
  retrieve["项目级混合检索"]
  evidence["引用快照"]
  artifact[("Artifact + Citations")]

  sources --> validate --> parse --> split
  split --> revision
  split --> embed --> chunks
  revision --> chunks --> activate --> retrieve --> evidence --> artifact
```

- 新 revision 完整成功后才替换旧 active revision；失败时继续使用旧版本。
- 检索在数据库层同时过滤 `project_id` 和 active revision。
- 来源内容作为不可信上下文，不能控制权限、状态或数据库写入。
- 来源删除后新检索不可命中，历史产物仍保留生成时引用快照。

## 恢复与增量重生成

```text
节点成功
  → 原子提交内部业务副作用
  → 保存 Graph checkpoint
  → 进入下一节点或人工 interrupt

节点失败或进程中断
  → 复用最近 Graph Run
  → 从最近成功 checkpoint 恢复
  → 重放时复用已提交的内部结果

知识来源变化
  → 服务端计算受影响产物闭包
  → 只重新生成受影响产物
  → 未受影响产物保持不变
```

运行模式与回退开关见 [`deployment.md`](./playbooks/deployment.md)。

## 核心数据关系

```mermaid
erDiagram
  PROJECT ||--o{ CONVERSATION : contains
  CONVERSATION ||--o{ MESSAGE : contains
  PROJECT ||--o{ WORKFLOW_STATE : tracks
  PROJECT ||--o{ WORKFLOW_EXECUTION : runs
  PROJECT ||--o{ ANALYSIS_RESULT : owns
  PROJECT ||--o{ ARTIFACT : owns
  ARTIFACT ||--o{ ARTIFACT_CITATION : preserves
  PROJECT ||--o{ MODEL_EXECUTION_LOG : records
  PROJECT ||--|| TOKEN_USAGE : aggregates

  PROJECT ||--o{ KNOWLEDGE_SOURCE : owns
  KNOWLEDGE_SOURCE ||--o{ KNOWLEDGE_REVISION : versions
  KNOWLEDGE_REVISION ||--o{ KNOWLEDGE_DOCUMENT : contains
  KNOWLEDGE_DOCUMENT ||--o{ KNOWLEDGE_CHUNK : splits_into
  ARTIFACT_CITATION }o--|| KNOWLEDGE_CHUNK : snapshots

  PROJECT ||--o{ GRAPH_RUN : runs
  GRAPH_RUN ||--o{ TOOL_STEP : audits
  GRAPH_RUN }o--o{ KNOWLEDGE_CHUNK : uses
```

字段、约束和索引以 [`database.spec.md`](../specs/database.spec.md) 与 Prisma Schema 为准。
