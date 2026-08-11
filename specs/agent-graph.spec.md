# Agent Graph — P2 Contract

> Version: 2.0.0
> Status: P2 Contract
> Owner: Backend Lead + AI Infrastructure Lead

## 1. 目标与边界

V3 使用 LangGraph 承载现有 9 个业务阶段的执行、条件分支、人工 interrupt 和失败恢复。LangGraph 不替代产品状态、LLM Orchestrator、模型 Provider、成本控制或数据库权限边界。

本项目仍是单 Agent Workflow，不支持 Multi-Agent、Supervisor、运行时 MCP、任意 Tool 注册和无限制 ReAct 循环。

## 2. Graph State

```typescript
type PlanningGraphState = {
  graphRunId: string;
  logicalAttempt: number;
  projectId: string;
  stage: WorkflowStage;
  confirmedDecisions: DecisionSnapshot[];
  conversationId?: string;
  retrievalQuery?: string;
  evidence: EvidenceCitation[];
  toolSteps: ToolStep[];
  stageResult?: unknown;
  waitingFor?: 'review' | 'reply';
  qualityReport?: ArtifactQualityReport;
  error?: GraphError;
};
```

- `graphRunId` 同时作为 LangGraph `thread_id`，每次完整工作流运行唯一。
- `logicalAttempt` 从 1 开始，只在用户输入或确认导致业务继续时递增；进程崩溃后的同一
  checkpoint 重放保持不变，用于区分业务重入和节点重放。
- Graph checkpoint 是执行恢复来源；现有项目、工作流、消息和产物表是用户可见读模型和审计记录。
- Graph State 只保存恢复所需数据，不保存 API Key、完整原始文件或未脱敏异常栈。

## 3. Nodes And Edges

```text
START
  -> load_project_context
  -> choose_action
       -> execute_tools (0..3)
       -> run_stage
  -> validate_stage_result
       -> revise_once -> validate_stage_result
       -> human_interrupt
       -> persist_and_advance
  -> next stage or END
```

- 现有 9 个业务阶段及其顺序保持不变。
- `choose_action` 每阶段最多产生一次结构化 Action Plan，包含 0..3 个白名单 Tool；
  `AGENT_ACTIONS_ENABLED=false` 时跳过该节点并保留 P1 固定检索路径。
- 单个结果最多自动修订 1 次，保持 V2 质量循环上限。
- 需求澄清、需求融合、MVP 收缩和平台推荐继续使用人工检查点。

## 4. P2 Tool Contract

| Tool                | 输入                                     | 输出                     |
| ------------------- | ---------------------------------------- | ------------------------ |
| `searchKnowledge`   | `projectId`, `query`, filters, `topK<=8` | `EvidenceCitation[]`     |
| `readSource`        | `projectId`, `documentId`, locator       | 限长的来源内容与元数据   |
| `inspectRepository` | `projectId`, sourceId, path/query        | 目录、依赖或代码位置摘要 |
| `getArtifact`       | `projectId`, artifactType                | 已持久化的前序产物       |

- Tool 输入必须通过共享 Zod Schema 校验并由服务端覆盖 `projectId`，不得信任模型提供的项目 ID。
- 模型提交的 `projectId` 与服务端项目不一致时在读取前拒绝并审计；实际查询始终只使用服务端项目 ID。
- Tool 只能读取当前项目数据，不得写数据库、推进阶段或调用模型。
- 每次调用记录 `graph_run_id`、node、tool、参数摘要、结果数量、耗时、状态和错误码。
- Action Plan 使用严格的 Zod discriminated union，一次最多 3 个 Action；未知 Tool、第四个 Action
  或不安全路径无法进入执行器。结构化输出失败可重试一次，连续失败则当前阶段失败。
- `requestHumanInput` 使用 LangGraph interrupt 实现，不作为可任意执行的外部 Tool。

## 5. LLM 与路由边界

- Graph Node 只能调用 `LlmOrchestratorService`，不得 import Provider、Adapter、OpenAI SDK 或白山 Client。
- 阶段模型路由、重试、首 delta 前降级、Token 和成本记录继续遵守现有规格。
- Agent Action 必须使用 Structured Output；解析或 Zod 校验失败不得执行 Tool，可重试一次后转为受控失败。
- RAG Evidence 作为 `untrusted-context` 注入，系统指令、已确认决策和工具规则优先级不可被来源内容覆盖。

## 6. Interrupt、恢复与幂等

- interrupt 前的副作用必须已提交且幂等，或推迟到 resume 后执行。
- 恢复请求必须携带当前 `graphRunId` 和预期 checkpoint 版本；过期请求返回状态冲突。
- 节点写入使用 `graph_run_id + node/stage + logical_attempt` 幂等键，重放不得重复创建消息、产物、执行日志或 Token 汇总。
- 检查点用户/助手消息必须作为当前 Graph 节点的幂等副作用，在该节点 checkpoint 提交前落库；不得先把 Graph Run 标为 `interrupted` 再创建唯一可推进的对话。
- 节点失败后，用户重新运行同一项目时复用最近 failed Graph Run，从最近成功 checkpoint
  恢复；已经成功的节点不得重复执行。外部模型 Provider 不提供幂等协议时，crash window
  可能重新发起相同请求，但内部调用日志与 Token/成本汇总必须在同一事务内和业务读模型一样只提交一次。
- 用户取消沿用 AbortSignal，Graph Run 标记 `cancelled`，不保存半条助手消息。

## 7. SSE 与用户状态

- 现有 `run`、`continue`、`discuss` SSE 行为保持不变；LangGraph Node 产生的文本仍通过现有 Workflow SSE 适配层发送。
- `done` 继续作为消息与工作流状态持久化后的成功提交点。
- 状态响应返回 Graph Run、当前 Node、Tool 调用次数、脱敏检索摘要、interrupt 原因和 Tool 轨迹；
  不返回完整参数、来源内容、Prompt 或内部异常。
- 内部检索与非用户可见分析不逐 Chunk 推送，只暴露脱敏的阶段状态。

## 8. 成本与限制

- 每次 Node 或 Tool 前复用现有持久化项目成本准入检查。
- Embedding 成本与 Chat Token 分开记录，并汇总到项目成本视图。
- 单阶段 Tool 调用上限 3 次、自动修订上限 1 次、现有澄清轮数上限 5 次。
- 达到成本上限后不得启动新模型或 Embedding 调用；纯数据库读取和查看已有产物仍可执行。

## 9. 失败策略

| 场景                      | 行为                                               |
| ------------------------- | -------------------------------------------------- |
| 无知识源或无检索结果      | 降级运行 V2 阶段，标记 `insufficient_evidence`     |
| Tool 参数无效             | 不执行；记录错误并允许 Action 重试一次             |
| 知识库暂时不可用          | 不切换项目或来源；按无证据路径继续或进入人工检查点 |
| Agent Action 连续校验失败 | 当前阶段失败，不执行自由文本中的潜在 Tool 指令     |
| interrupt 后进程重启      | 使用持久化 checkpoint 和相同 `graphRunId` 恢复     |
| resume claim 后进程退出   | 租约到期后允许同一 checkpoint 重新 claim           |
| 首个 SSE delta 后模型失败 | 不切换模型，沿用现有流式一致性规则                 |

## 10. 验收标准

- 9 个阶段和 4 个检查点的 V2 行为回归通过。
- Graph 能在进程重启后恢复到最近 checkpoint。
- resume claim、项目阶段推进和 execution 创建必须原子提交；运行中 claim 使用可续期租约，过期后可恢复。
- 同一 checkpoint 重复 resume 不产生重复副作用。
- Tool 白名单、Zod 参数校验和单阶段 3 次上限不可绕过。
- Agent 无法通过知识内容改变项目 ID、模型调用链或合法状态转换。
- Graph 轨迹能够关联模型日志、检索证据、Token 和成本。
- 没有知识源时可以完成原有 Mock Eval。
- 相同 `graph_run_id + stage + logical_attempt + call_number` 重放复用已有 Tool 结果，不重复写审计记录或产生调用成本；业务阶段重入递增 `logical_attempt`，不得复用上一次业务尝试的结果。
- 并发命中同一 Tool 幂等键时只有 claim owner 执行读取；其他执行者等待结果，只有 owner 租约过期后可接管。

## 11. 版本边界

本规格为 P2 Contract。LangGraph 是默认执行来源；`AGENT_ACTIONS_ENABLED=false` 回退 P1
固定检索 Graph，`WORKFLOW_RUNNER=v2` 继续作为旧执行器的最终回退。
