# 项目第一性原理与对抗式审查

> Date: 2026-08-11  
> Scope: V2 当前工作流与 V3 P0/P1/P2 的代码、文档、契约和测试  
> Method: 两个独立 subagent 分别执行第一性原理审查与对抗式审查，主 Agent 复核并去重  
> Nature: 时间点审查报告，不替代 product/spec/contract；本轮未执行故障注入和并发压测

## 结论

V3 的 happy path、项目级检索隔离、Tool 白名单、正常 interrupt/resume、引用快照、增量重生成主路径和三浏览器 E2E 均有实现与测试证据。

但严格按现有完成标准，不能无保留地声明“V3 P0/P1/P2 已全部完成”。本次确认 15 个去重问题：P0 0 个、P1 11 个、P2 4 个。主要缺口集中在失败恢复与重放幂等、并发准入、失败回退、增量重生成原子性和资源安全。

在 P1 修复前，建议对外表述为：**功能主路径完成，Mock、常规集成和 E2E 已通过；失败恢复、并发与资源边界尚未达到严格发布标准。**

## 优先级

| 级别 | 含义                                                                                |
| ---- | ----------------------------------------------------------------------------------- |
| P0   | 可直接造成严重安全或不可恢复数据事故，立即阻断发布                                  |
| P1   | 违反已承诺的完成标准，或在合理故障/并发下造成卡死、重复费用、数据不一致，发布前修复 |
| P2   | 中等风险、运维/安全纵深或验证缺口，进入下一修复批次                                 |

## 问题汇总

| ID     | 级别 | 问题                                                    | 来源         | 置信度 |
| ------ | ---- | ------------------------------------------------------- | ------------ | ------ |
| AUD-01 | P1   | Graph 失败恢复与节点副作用重放幂等未成立                | 双路         | 高     |
| AUD-02 | P1   | Tool 幂等键缺少 logical attempt，合法阶段重入复用旧结果 | 第一性原理   | 高     |
| AUD-03 | P1   | 首次 run 失败或取消后项目可能无法重启                   | 第一性原理   | 高     |
| AUD-04 | P1   | 首次 workflow run 缺少原子 claim                        | 双路         | 高     |
| AUD-05 | P1   | resume 抢占后的中间故障会锁死 Graph                     | 对抗式       | 高     |
| AUD-06 | P1   | reindex 失败后旧 active revision 实际不可检索           | 双路         | 高     |
| AUD-07 | P1   | 增量重生成部分成功后可能丢失剩余 stale 状态             | 对抗式       | 高     |
| AUD-08 | P1   | 产物替换非事务，创建失败会丢失旧 active 产物            | 双路关联确认 | 高     |
| AUD-09 | P1   | 单进程限流可绕过且 Map 缺少硬容量                       | 对抗式       | 高     |
| AUD-10 | P1   | 上传/PDF/Embedding 同步链路存在资源耗尽路径             | 对抗式       | 高     |
| AUD-11 | P1   | GitHub secret 检测只扫描文件前 4 KiB                    | 双路         | 高     |
| AUD-12 | P2   | 完整 Prompt/响应持久化并由 API 返回，与运维文档冲突     | 对抗式       | 高     |
| AUD-13 | P2   | Tool `running` 行不能阻止并发重复执行                   | 对抗式       | 高     |
| AUD-14 | P2   | V2/P1 回退开关缺少完整 HTTP/E2E 行为证据                | 对抗式       | 高     |
| AUD-15 | P2   | 默认无鉴权与任意 Origin CORS 组合扩大本地暴露面         | 对抗式       | 中高   |

### 关键证据行号索引

| ID     | 关键实现/测试位置                                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUD-01 | `apps/api/src/modules/workflow/graph/agent-graph.service.ts:59-91,115-127`; `apps/api/src/modules/workflow/workflow-pipeline-runner.ts:94-109`; `apps/api/src/modules/workflow/stages/analysis-result-persister.ts:21-37`; `apps/api/src/modules/workflow/stages/model-call-log.ts:42-67` |
| AUD-02 | `packages/database/prisma/schema.prisma:261-283`; `apps/api/src/modules/workflow/graph/agent-tool.service.ts:125-148`; `apps/api/src/modules/workflow/workflow-stream-actions.ts:82-100`                                                                                                  |
| AUD-03 | `apps/api/src/modules/workflow/workflow-executor.ts:183-204`; `apps/api/src/modules/workflow/workflow-guards.ts:6-25`                                                                                                                                                                     |
| AUD-04 | `apps/api/src/modules/workflow/workflow-stream-actions.ts:50-59`; `apps/api/src/modules/workflow/workflow-guards.ts:18-25`                                                                                                                                                                |
| AUD-05 | `apps/api/src/modules/workflow/graph/agent-graph.service.ts:115-127`; `apps/api/src/modules/workflow/workflow-stream-actions.ts:82-100`; `apps/api/src/modules/workflow/workflow.service.ts:88-107`                                                                                       |
| AUD-06 | `apps/api/src/modules/knowledge/knowledge-index.store.ts:60-83`; `packages/database/src/knowledge-vector.repository.ts:68-100`; `apps/api/test/integration/http-knowledge.integration.test.ts:91-121`                                                                                     |
| AUD-07 | `apps/api/src/modules/workflow/artifact-generation/artifact-generator.ts:65-80,93-139`; `apps/api/src/modules/workflow/stages/planning-generation.stage.ts:28-38`; `apps/api/src/modules/workflow/artifact-generation/artifact-impact.ts:117-134`                                         |
| AUD-08 | `apps/api/src/modules/workflow/artifact-generation/artifact-file-store.ts:23-34,61-100`                                                                                                                                                                                                   |
| AUD-09 | `apps/api/src/common/guards/workflow-rate-limit.guard.ts:23-59`; `apps/api/src/common/guards/auth.guard.ts:24-32`                                                                                                                                                                         |
| AUD-10 | `apps/api/src/modules/knowledge/knowledge.controller.ts:34-42`; `apps/api/src/modules/knowledge/knowledge-parser.ts:122-180`; `apps/api/src/modules/knowledge/knowledge-indexer.service.ts:123-139`                                                                                       |
| AUD-11 | `apps/api/src/modules/knowledge/github-archive.ts:139-142`; `apps/api/test/unit/github-repository.client.test.ts:30`                                                                                                                                                                      |
| AUD-12 | `apps/api/src/modules/workflow/stages/model-call-log.ts:42-64`; `apps/api/src/modules/usage/usage.dto.ts:158-165`; `docs/playbooks/deployment.md:43-50`                                                                                                                                   |
| AUD-13 | `apps/api/src/modules/workflow/graph/agent-tool.service.ts:84-102,125-148`                                                                                                                                                                                                                |
| AUD-14 | `apps/api/test/workflow/agent-action.service.test.ts:34-48`; `apps/api/test/workflow/agent-graph.service.test.ts:39-46`                                                                                                                                                                   |
| AUD-15 | `apps/api/src/main.ts:23-28`; `apps/api/src/common/guards/auth.guard.ts:24-26`; `apps/api/src/config/app-config.service.ts:50-53`                                                                                                                                                         |

## P1：发布前修复

修复进度（完整 PostgreSQL/HTTP/E2E 证据统一在 remediation final gates 执行）：

| ID     | 状态   | 聚焦证据                                                                 |
| ------ | ------ | ------------------------------------------------------------------------ |
| AUD-01 | 已实现 | failed/lease retry；节点结果、模型计账、产物和 checkpoint 消息均幂等     |
| AUD-02 | 已实现 | logical attempt 业务重入/同 attempt replay 单测通过                      |
| AUD-03 | 已实现 | 初次失败、取消进入可重试 failed；continue 显式恢复检查点单测通过         |
| AUD-04 | 已实现 | project 条件更新与 execution 创建同事务；并发单测通过                    |
| AUD-05 | 已实现 | resume claim 原子事务 + 可续期租约；回滚/过期恢复 PostgreSQL 用例已加入  |
| AUD-06 | 已实现 | 旧 active 存在时 source 保持 searchable；失败后检索集成断言已加入        |
| AUD-07 | 已实现 | 增量失败目标持久化并与动态 impact 合并；聚焦回归通过                     |
| AUD-08 | 已实现 | 旧 artifact soft-delete 与新 artifact/citations 创建同事务；回滚测试通过 |
| AUD-09 | 已实现 | 无鉴权按 IP；caller 全局+项目 bucket；10,000 硬上限测试通过              |
| AUD-10 | 已实现 | 200 页/200 万字符/2,000 chunks/2 并发及写接口限流测试通过                |
| AUD-11 | 已实现 | 扫描完整缓存文件；4 KiB 后密钥 fixture 通过                              |
| AUD-12 | 已实现 | 调用日志仅保留 hash、长度、成本和受限摘要；旧完整内容由迁移删除          |
| AUD-13 | 已实现 | claim token + lease；并发同 key 仅 owner 执行，超时后才允许接管          |
| AUD-14 | 已实现 | P1/V2 两条完整 Mock HTTP 回退用例已加入 CI                               |
| AUD-15 | 已实现 | 默认 loopback、精确 CORS allowlist；非 loopback 无 API key 时拒绝启动    |

### AUD-01 Graph 失败恢复与节点副作用重放幂等未成立

- **证据：** [`agent-graph.service.ts`](../../apps/api/src/modules/workflow/graph/agent-graph.service.ts) 把节点异常直接标为 `failed`，resume 只接受 `interrupted`；[`workflow-pipeline-runner.ts`](../../apps/api/src/modules/workflow/workflow-pipeline-runner.ts)、[`analysis-result-persister.ts`](../../apps/api/src/modules/workflow/stages/analysis-result-persister.ts) 和 [`model-call-log.ts`](../../apps/api/src/modules/workflow/stages/model-call-log.ts) 在节点 checkpoint 前已执行非幂等副作用。
- **失败路径与影响：** 数据库副作用完成后、checkpoint 保存前进程退出；重跑会重复模型费用、成本、日志和分析结果，而正常捕获的 failed run 又没有恢复入口。
- **最小修复：** 为副作用增加 `graph_run_id + node + logical_attempt` 唯一幂等键并复用结果；提供 failed-run 恢复入口；补真实 PostgreSQL crash-window 测试。

### AUD-02 Tool 合法阶段重入会复用旧结果

- **证据：** [`schema.prisma`](../../packages/database/prisma/schema.prisma) 的 `ToolStep` 唯一键只有 `(graph_run_id, stage, call_number)`；[`agent-tool.service.ts`](../../apps/api/src/modules/workflow/graph/agent-tool.service.ts) 命中后复用旧结果。
- **失败路径与影响：** 用户澄清后同一 run 再次进入 `requirement_analysis`，新 action 命中第一次 Tool #1，动态取证陈旧且审计误导。
- **最小修复：** Graph state 增加 `logical_attempt`；checkpoint replay 保持 attempt，业务重入递增 attempt，并纳入唯一键。

### AUD-03 首次 run 失败或取消后项目可能无法重启

- **证据：** [`workflow-executor.ts`](../../apps/api/src/modules/workflow/workflow-executor.ts) 的首次流式失败恢复把 stage 改为 `requirement_clarification`，但没有改为可重启的 `failed/init`；[`workflow-guards.ts`](../../apps/api/src/modules/workflow/workflow-guards.ts) 会拒绝新的 run。
- **失败路径与影响：** waiting interaction 落库前 timeout/断开，之后 `/run` 与 `/continue` 都返回冲突，项目卡死。
- **最小修复：** 首次失败原子回滚到 `init`，或统一落到 `failed/current_stage=failed`；补“首次失败后重新 run 成功”的 HTTP 测试。

### AUD-04 首次 workflow run 缺少原子 claim

- **证据：** [`workflow-stream-actions.ts`](../../apps/api/src/modules/workflow/workflow-stream-actions.ts) 依次读取、内存判断、创建 execution、更新 project，没有条件更新或唯一约束。
- **失败路径与影响：** 两个并发 `/run` 均读到 `init`，分别创建 execution/GraphRun，造成重复付费与状态、消息、产物竞争。
- **最小修复：** 用条件 `updateMany` 原子 claim 预期状态并与 execution create 放入同一事务；补 PostgreSQL 并发测试。

### AUD-05 resume 抢占后的中间故障会锁死 Graph

- **证据：** [`agent-graph.service.ts`](../../apps/api/src/modules/workflow/graph/agent-graph.service.ts) 先把 `interrupted` 改为 `running`；[`workflow-stream-actions.ts`](../../apps/api/src/modules/workflow/workflow-stream-actions.ts) 随后才创建 execution、更新项目并执行 Graph。
- **失败路径与影响：** claim 后任一写入或进程故障，后续 resume 永久 stale，原项目仍可能停留在等待态。
- **最小修复：** claim 与必要状态写入同一事务；或引入 lease，并在所有 claim 后失败路径条件回滚。

### AUD-06 reindex 失败后旧 active revision 实际不可检索

- **证据：** [`knowledge-index.store.ts`](../../apps/api/src/modules/knowledge/knowledge-index.store.ts) 保留旧 active revision 却把 source 改为 `failed`；[`knowledge-vector.repository.ts`](../../packages/database/src/knowledge-vector.repository.ts) 只检索 ready source。
- **失败路径与影响：** 新 Embedding 全失败后旧 revision 仍 active，但 search 返回 `insufficient_evidence`，与“失败时继续使用旧 revision”相反。
- **最小修复：** 有旧 active 时只标新 revision failed，source 恢复旧 ready 状态并记录 warning；补失败后、repair 前检索旧 chunk 的测试。

### AUD-07 增量重生成部分成功后可能丢失剩余 stale 状态

- **证据：** [`artifact-generator.ts`](../../apps/api/src/modules/workflow/artifact-generation/artifact-generator.ts) 并行生成并逐个立即替换；[`planning-generation.stage.ts`](../../apps/api/src/modules/workflow/stages/planning-generation.stage.ts) 最后才因部分失败报错；[`artifact-impact.ts`](../../apps/api/src/modules/workflow/artifact-generation/artifact-impact.ts) 重新根据当前数据推导影响。
- **失败路径与影响：** 上游产物成功替换、下游失败后，下一次 impact 可能不再包含仍旧的下游产物，项目保留无法再触发修复的混合版本。
- **最小修复：** 全部目标先暂存、全部成功后原子切换；或持久化失败目标供下一次继续处理。

### AUD-08 产物替换不是事务

- **证据：** [`artifact-file-store.ts`](../../apps/api/src/modules/workflow/artifact-generation/artifact-file-store.ts) 先 soft-delete 旧行，再独立 create 新 artifact/citations；create 失败只删除新文件。
- **失败路径与影响：** 新 artifact 创建失败时，最后一份旧 active 产物已不可见。
- **最小修复：** 将 soft-delete 与 create 放入同一 Prisma transaction；补失败后旧 ID、内容和时间戳不变的测试。

### AUD-09 单进程限流可绕过且 Map 缺少硬容量

- **证据：** [`workflow-rate-limit.guard.ts`](../../apps/api/src/common/guards/workflow-rate-limit.guard.ts) 在无鉴权模式仍优先使用任意 `Authorization` 值作为 caller，并以 `project_id + caller` 建 key；prune 没有硬容量。
- **攻击路径与影响：** 更换未验证 Authorization 和 project UUID 可持续获得新 bucket、扩大 Map、绕过限流并造成内存压力。该问题超出已登记的“多实例不共享计数”债务。
- **最小修复：** 无鉴权时只使用规范化 IP；增加 caller 全局 bucket、Map 硬容量和淘汰。

### AUD-10 上传/PDF/Embedding 同步链路存在资源耗尽路径

- **证据：** [`knowledge.controller.ts`](../../apps/api/src/modules/knowledge/knowledge.controller.ts) 只限制输入为 20 MiB；[`knowledge-parser.ts`](../../apps/api/src/modules/knowledge/knowledge-parser.ts) 在请求内全量提取 PDF、切片和 token 计数；[`knowledge-indexer.service.ts`](../../apps/api/src/modules/knowledge/knowledge-indexer.service.ts) 同步执行全部 Embedding 批次。
- **攻击路径与影响：** 重复提交高压缩/超多页 PDF 或不同内容的大文本，输入字节限制无法约束解压文本、页数和 chunk 数，耗尽 CPU、内存、数据库或远程 Embedding 配额。
- **最小修复：** 增加页数、提取字符数、chunk 数与索引并发上限，并为知识写接口限流；只有实际负载需要时再引入持久队列。

### AUD-11 GitHub secret 检测只扫描文件前 4 KiB

- **证据：** [`github-archive.ts`](../../apps/api/src/modules/knowledge/github-archive.ts) 的 `hasLikelySecret()` 只扫描 `buffer.subarray(0, 4096)`。
- **攻击路径与影响：** 在第 4097 字节后放 PEM key 或匹配 token，secret 会进入索引、Embedding、模型上下文及可能的调用日志。
- **最小修复：** 扫描已完整缓存的全部 buffer；补“凭据位于 4 KiB 后”的 fixture，并谨慎扩展高置信度模式。

## P2：下一修复批次

### AUD-12 完整 Prompt/响应持久化与运维文档冲突

- **证据：** [`model-call-log.ts`](../../apps/api/src/modules/workflow/stages/model-call-log.ts) 保存脱敏后的完整 Prompt、响应和 structured output；[`usage.dto.ts`](../../apps/api/src/modules/usage/usage.dto.ts) 通过详情 API 返回；[`deployment.md`](../playbooks/deployment.md) 要求日志不得包含完整 Prompt/响应。
- **影响：** 正则脱敏不能覆盖全部个人数据与 secret，且实现与文档边界不一致。
- **最小修复：** 明确审计与隐私需求。推荐默认只保存 hash、PromptVersion、长度、成本和受限摘要；完整内容仅在显式 debug 模式短期保存，并同步 spec/OpenAPI/文档。

### AUD-13 Tool `running` 行不能阻止并发重复执行

- **证据：** [`agent-tool.service.ts`](../../apps/api/src/modules/workflow/graph/agent-tool.service.ts) 命中 `running` 且无 result 的 row 后仍继续执行 Tool。
- **影响：** 两个执行者可重复检索/Embedding，唯一审计行却掩盖实际重复调用。
- **最小修复：** 条件状态抢占或 advisory lock；非 owner 等待结果，只在 lease 超时后接管。

### AUD-14 回退开关缺少完整行为证据

- **证据：** 测试只验证配置和局部行为，没有通过 `AGENT_ACTIONS_ENABLED=false` 或 `WORKFLOW_RUNNER=v2` 完成完整 HTTP 工作流。
- **影响：** P1/V2 operational rollback 未覆盖 SSE、四个检查点和 11 类产物。
- **最小修复：** 增加两条 Mock HTTP integration：关闭 Action 完成 P1 路径；切换 V2 runner 完成九阶段、四检查点和 11 类产物。

### AUD-15 默认无鉴权与任意 Origin CORS 组合扩大本地暴露面

- **证据：** [`main.ts`](../../apps/api/src/main.ts) 使用 `origin: true, credentials: true`；[`auth.guard.ts`](../../apps/api/src/common/guards/auth.guard.ts) 在 `API_KEY` 为空时放行；监听未显式限制 loopback。
- **攻击路径与影响：** 本地 API 未配置 key 时，恶意网页可尝试访问项目数据和模型操作。浏览器 Private Network Access 可能降低部分环境的可利用性，因此置信度为中高。
- **最小修复：** CORS 只允许配置的 Web origin；无鉴权模式显式只绑定 loopback，非本地部署要求非空 API key。

## 已验证成立的防护与完成项

- 混合检索在 SQL 层同时过滤 `project_id`、未删除 source 和 active revision，并使用参数化 SQL。
- Tool 使用严格白名单、Zod 校验、服务端 project ID 校验和最多 3 次限制。
- GitHub URL 固定为 HTTPS `github.com` 两段路径；服务端构造 API/codeload URL并禁用自动重定向，SSRF 主路径被阻断。
- Tar 只接受普通文件并拒绝空段、`.`、`..`；符号链接不会作为文件进入索引。
- 不可信上下文有 delimiter；当前 Tool 全部只读，没有来源文本可触发的写 Tool。
- SSE AbortSignal 能传播；首 token 后不会切换 Provider。
- 并发 regenerate 已使用项目条件更新原子 claim。
- 引用保存生成时快照，来源删除后仍可展示；下载接口检查项目归属。
- CI 运行 PostgreSQL HTTP integration、三浏览器 E2E 和 Docker smoke。

## 验证边界

本轮未运行真实 Baishan、真实 Embedding、在线 GitHub smoke、并发压测或数据库 crash fault injection。涉及 crash window、并发和资源耗尽的条目应在修复时补实验性回归测试。

未逐行审查纯 UI 样式、全部 Prompt 文案、第三方依赖源码和 PDF 渲染实现。低确定性线索未列入问题。

## 推荐修复顺序

1. AUD-04、AUD-03、AUD-05：保证 workflow admission、失败和 resume 不会卡死。
2. AUD-01、AUD-02、AUD-13：统一 Graph/Tool logical attempt 与副作用幂等语义。
3. AUD-06、AUD-07、AUD-08：修复知识与产物的回退/原子切换。
4. AUD-09、AUD-10、AUD-11、AUD-15：收紧资源与安全边界。
5. AUD-12、AUD-14：统一审计数据策略并补齐回退验证。
