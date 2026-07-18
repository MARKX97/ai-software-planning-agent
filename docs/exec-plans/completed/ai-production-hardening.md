# AI Production Hardening

> Status: Completed

## Goal

在不改变产品主流程和数据库 Schema 的前提下，补齐 API 认证、模型调用限流、持久化成本准入、Prompt 信任边界、流式模型降级和 Docker 本地演示闭环。

## Acceptance Criteria

- 受保护 API 实际执行 Bearer 认证，公开路由保持可访问。
- 模型工作流操作按项目和调用方限流，并在持久化成本达到上限后拒绝新调用。
- 用户可见流式对话在首个 delta 前支持 `glm -> minimax -> deepseek` 降级，每次 Provider 尝试可审计。
- 模型输入中的高置信度密钥被阻断，Prompt 上下文带显式不可信边界。
- `docker compose up --build` 可启动 PostgreSQL、API 和 Web，真实模型密钥只进入 API 容器。
- Harness、测试、CI 和文档可以阻止上述约束回退。

## Decisions

- 不新增运行时依赖、数据库迁移、Python 服务、LangChain、向量数据库、Redis 或 K8s。
- 持久化成本限制是 admission control：已经并行发出的调用可以结算到配置值以上，但达到上限后不再接受新的模型工作流操作。
- 流式回复已经输出任何 delta 后不得切换 Provider，避免用户看到重复文本。
- 限流器使用单进程固定窗口；只有未来出现多实例部署需求时才迁移到网关或共享存储。
- Docker 只用于本地 Demo，不包含生产发布、镜像仓库或自动部署。

## Contract Impact

- 新增 `WORKFLOW_RATE_LIMIT_PER_MINUTE`。
- 新增 `callSingleStreamWithFallback()`、`LLMFallbackAttempt` 和 `LLMFallbackStreamOptions`。
- `run`、`continue`、`discuss`、`advance` 增加 `429 RATE_LIMITED` 与 `503 COST_LIMIT_EXCEEDED`。
- 成功响应、现有路径和数据库 Schema 不变。

## Progress

- [x] 完成现状分析和方案决策。
- [x] 更新人读契约与 OpenAPI。
- [x] 实现安全、预算和模型降级。
- [x] 增加 Docker 与 Harness/CI 检查。
- [x] 完成全量代码验证并移动到 completed。

## Validation

- `pnpm harness:check`：通过。
- `pnpm verify:fast`：通过。
- `pnpm verify`：通过，包括格式、Harness、lint、typecheck、全仓测试和生产构建。
- LLM Core：25 通过，1 个付费真实白山测试按默认配置跳过。
- LLM Orchestrator：18 通过。
- API：72 通过，1 个真实 PostgreSQL HTTP 集成测试按默认配置跳过。
- Web：17 通过。
- 本机未安装 Docker CLI，未执行本地 Compose smoke test；GitHub Actions 已增加独立 `docker-smoke` job 负责构建、迁移、健康检查和清理。
