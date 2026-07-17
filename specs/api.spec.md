# API — System Contract

> Version: 1.2.0
> Status: Contract Summary
> Owner: Backend Lead + Frontend Lead
> Machine Contract: `contracts/openapi.yaml`
> Tokens: ~3,000

---

## 1. 契约分工

`contracts/openapi.yaml` 是 API 的机器可读唯一契约，开发、类型生成、契约测试和前端 API Client 都以它为准。

本文档只维护人读摘要、实现约束和开发 Agent 加载策略，不重复维护请求/响应字段细节。

规则:

- 新增、删除、修改接口时，先更新 `contracts/openapi.yaml`。
- 本文档只同步接口清单、行为约束、错误策略和实现注意事项。
- 若本文档与 OpenAPI 冲突，以 `contracts/openapi.yaml` 为准，并修正本文档。

## 2. 基础规范

| 属性       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| Base URL   | `/api/v1`                                                   |
| 数据格式   | JSON；模型可见回复使用 SSE                                  |
| 认证方式   | Bearer Token                                                |
| 免认证接口 | `GET /health`, `GET /models`, `GET /models/{provider_name}` |
| 分页       | `offset` + `limit`，各接口默认 20 或 50，最大 100           |
| 时间格式   | ISO 8601 UTC                                                |
| 错误格式   | `{ error: { code, message, details? } }`                    |

## 3. 接口清单

| Method | Path                                                              | 说明         |
| ------ | ----------------------------------------------------------------- | ------------ |
| GET    | `/health`                                                         | 健康检查     |
| GET    | `/models`                                                         | 可用模型列表 |
| GET    | `/models/{provider_name}`                                         | 模型详情     |
| POST   | `/projects`                                                       | 创建项目     |
| GET    | `/projects`                                                       | 项目列表     |
| GET    | `/projects/{project_id}`                                          | 项目详情     |
| DELETE | `/projects/{project_id}`                                          | 软删除项目   |
| POST   | `/projects/{project_id}/run`                                      | 启动工作流   |
| GET    | `/projects/{project_id}/workflow/status`                          | 工作流状态   |
| POST   | `/projects/{project_id}/workflow/continue`                        | 继续工作流   |
| POST   | `/projects/{project_id}/workflow/discuss`                         | 讨论检查点   |
| POST   | `/projects/{project_id}/workflow/advance`                         | 确认并推进   |
| GET    | `/projects/{project_id}/workflow/states`                          | 阶段状态     |
| GET    | `/projects/{project_id}/workflow/executions`                      | 执行历史     |
| GET    | `/projects/{project_id}/workflow/executions/{execution_id}`       | 执行详情     |
| GET    | `/projects/{project_id}/workflow/executions/{execution_id}/logs`  | 执行日志     |
| POST   | `/projects/{project_id}/conversations`                            | 创建对话     |
| POST   | `/projects/{project_id}/conversations/{conversation_id}/messages` | 发送消息     |
| GET    | `/projects/{project_id}/conversations/{conversation_id}/messages` | 消息历史     |
| GET    | `/projects/{project_id}/artifacts`                                | 产物列表     |
| GET    | `/projects/{project_id}/artifacts/{artifact_id}`                  | 产物详情     |
| GET    | `/projects/{project_id}/artifacts/{artifact_id}/download`         | 下载产物     |
| POST   | `/projects/{project_id}/export/prd`                               | 创建导出任务 |
| GET    | `/projects/{project_id}/export/{export_id}`                       | 导出状态     |
| GET    | `/projects/{project_id}/export/{export_id}/download`              | 下载导出     |
| GET    | `/usage/tokens`                                                   | Token 用量   |
| GET    | `/projects/{project_id}/usage/logs`                               | 模型调用日志 |
| GET    | `/projects/{project_id}/usage/logs/{log_id}`                      | 日志详情     |

## 4. 实现约束

### 4.1 Controller

- Controller 只做 request/response 组装，不写业务逻辑。
- 所有输入通过 DTO + Zod 或 Nest Pipe 校验。
- 返回值必须通过 Response DTO 映射，不直接返回 Prisma 实体。
- 不向前端返回内部异常栈、数据库错误、原始 SDK 错误。

### 4.2 Service

- 业务逻辑放在 service 层。
- DB 访问通过 repository 或 Prisma service。
- LLM 调用只允许白名单模块通过 `LlmOrchestratorService`。
- `run`、`workflow/continue`、`workflow/discuss` 返回 `200 text/event-stream`；`workflow/advance` 仍返回 `202 application/json`。
- Controller 只绑定 SSE headers 和输出，模型调用与持久化仍由 Workflow Service/Stage 完成。

### 4.3 Error

| HTTP | 场景                   |
| ---- | ---------------------- |
| 400  | 参数校验失败           |
| 401  | 未提供认证             |
| 403  | API Key 无效           |
| 404  | 资源不存在             |
| 409  | 状态冲突或非法阶段转换 |
| 429  | 频率超限               |
| 500  | 内部错误               |
| 502  | LLM 或导出依赖失败     |
| 503  | 成本限制或服务不可用   |

错误码枚举以 `contracts/openapi.yaml` 为准。

## 5. 前端对接约束

- 前端 API Client 必须从 `contracts/openapi.yaml` 生成类型或手动保持一致。
- 所有列表接口必须处理分页。
- `workflow/status` 是前端轮询的唯一状态入口。
- `workflow/status.conversation_id` 指向当前检查点会话；`waiting_for=reply` 表示 Agent 需要补充信息，`waiting_for=review` 表示可讨论或确认推进。
- `workflow/continue` 只用于需求澄清回复；其他检查点讨论使用 `workflow/discuss`，确认后使用 `workflow/advance`。
- 三个流式接口使用 Fetch POST 读取 SSE。允许多个 `delta`，随后必须且只能有一个 `done` 或 `error`；服务端每 15 秒发送 comment heartbeat。
- SSE 响应必须使用 `Content-Type: text/event-stream`、`Cache-Control: no-cache, no-transform` 和 `X-Accel-Buffering: no`，避免中间代理缓存或缓冲。
- 流开始前的校验/权限/阶段错误返回标准 JSON HTTP Error；流开始后的模型错误通过 SSE `error` 返回。
- `done` 携带已持久化的 `assistant_message` 和最新 `status`。浏览器不得接触 Baishan Base URL 或 API Key。
- Usage 与调用日志响应包含白山返回的 `cached_tokens` / `total_cached_tokens` 和 `cost_cached`；这些字段用于解释本地成本估算，不替代白山控制台账单。
- `artifacts` 列表接口不返回完整 `content`，详情接口才返回。
- 导出接口创建任务后，前端轮询 `export/{export_id}`。

## 6. 契约测试

必须覆盖:

- OpenAPI schema 校验。
- 28 个接口的 success response。
- 参数错误、未认证、资源不存在、状态冲突。
- 关键轮询接口: workflow status、export status。
- SSE 分片解析、事件顺序、流前 JSON 错误、流后 error、取消和成功后原子持久化。

## 7. 版本兼容

- 当前为 pre-release；本次将三个工作流回复接口从 `202 JSON` 直接改为 `200 SSE`，属于已接受的破坏性变更，不保留旧响应。
- v1.x.0: 可新增接口和可选字段。
- v2.0.0: 允许破坏性变更。
