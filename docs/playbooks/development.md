# Development Playbook

> Status: Current

## Change Flow

1. 从 `docs/README.md` 定位权威 spec 和 contract。
2. 检查现有实现、调用方和工作树，不猜测业务行为。
3. API、Schema、数据库、架构或跨包改动先建立 execution plan。
4. 先更新文档和契约，再做最小实现。
5. 为行为变化补测试，运行 `pnpm verify:fast`。
6. 提交前运行 `pnpm verify`；需要 PostgreSQL/E2E 时按 CI 流程验证。

## Engineering Boundaries

- 复用现有模块和依赖，禁止为单一实现创建预留抽象。
- 不绕过 `LlmOrchestratorService`，不在 Controller 中调用模型。
- 外部输入在边界使用 Zod/DTO 校验，数据库查询使用 Prisma。
- 配置只从环境或配置服务读取；浏览器只能访问 `NEXT_PUBLIC_*`。
- 修复应落在所有调用方共用的根因位置，并补回归测试。

依赖矩阵和 LLM 白名单见 [`../architecture-overview.md`](../architecture-overview.md)。

## Verification

```bash
pnpm harness:check
pnpm verify:fast
pnpm verify
```

检查失败会返回规则编号、原因、修复方式和权威文档。存量代码形态豁免记录在 [`../tech-debt.md`](../tech-debt.md)，不得扩大。

## Contract Changes

| 变化                          | 必须同步                                                       |
| ----------------------------- | -------------------------------------------------------------- |
| HTTP 路由、状态码、请求或响应 | `specs/api.spec.md` + `contracts/openapi.yaml` + API/Web 类型  |
| Prisma 模型或约束             | `specs/database.spec.md` + Prisma migration                    |
| LLM 结构化输出                | `specs/schema.spec.md` + JSON Schema + Zod Schema              |
| Workflow 阶段或等待规则       | workflow/state-machine spec + API + Frontend spec              |
| 模型或 Prompt                 | provider/orchestrator/prompt/model-routing spec + Baishan 文档 |
