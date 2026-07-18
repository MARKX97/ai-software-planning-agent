# AI Software Planning Agent - Agent Rules

> Codex 直接读取本文件；Claude Code 通过 `CLAUDE.md` 进入。本文件只做地图，详细规则以链接文档为准。

## 1. Mission

- 默认使用中文交流，保留技术名词和错误原文。
- 先理解现有架构和契约，再做最小改动；文档先于代码更新。
- 不猜业务逻辑，不为了迎合用户接受有明显风险的方案。
- MVP 优先：未进入产品范围或 spec 的功能默认不做。

## 2. Sources Of Truth

| 主题                           | 权威来源                                       |
| ------------------------------ | ---------------------------------------------- |
| 文档地图与加载规则             | `docs/README.md`                               |
| 产品定位与范围                 | `docs/product-vision.md`                       |
| 架构与依赖方向                 | `docs/architecture-overview.md`                |
| 行为契约                       | `specs/*.spec.md`                              |
| 机器契约                       | `contracts/openapi.yaml`, `contracts/schemas/` |
| 开发、测试、部署、LLM playbook | `docs/playbooks/`                              |
| 复杂任务计划与技术债           | `docs/exec-plans/`, `docs/tech-debt.md`        |

具体任务只加载相关 spec，不批量加载所有文档。

## 3. Immutable Boundaries

- 技术栈：Next.js 15、NestJS 11、PostgreSQL 16、Prisma 6、TypeScript、Tailwind 4、pnpm、Turborepo。
- 禁止引入微服务、Multi-Agent、RAG、运行时 MCP、Redis、Kafka、WebSocket、GraphQL、向量数据库和 Agent 框架，除非先修改架构并获得确认。
- 唯一 LLM 调用链：`API workflow -> llm-orchestrator -> llm-providers -> llm-core adapter -> Baishan`。
- Controller 不调用模型；业务代码不直接 import Provider、Adapter 或 OpenAI SDK。
- API Key 只存在 API Server 环境，禁止进入浏览器、日志、仓库和产物。
- 公共类型、枚举、Schema 分别放在 `packages/shared/src/{types,enums,schemas}`；Prompt 放在 `apps/api/src/prompts`。
- Controller 只做 HTTP 绑定，业务放 Service，外部输入必须校验，数据库只通过 Prisma。
- Web API 调用集中在 feature API 层；UI 必须处理 loading、empty、error 和 retry。

完整依赖矩阵和允许的 LLM 白名单见 `docs/architecture-overview.md`，由 `pnpm harness:check` 强制执行。

## 4. Work Protocol

1. 读取 `docs/README.md` 和任务相关 spec。
2. 检查工作树，保留用户已有修改。
3. 复杂改动先在 `docs/exec-plans/active/` 建计划；小修复可直接处理。
4. 先更新契约/文档，再实现代码和测试。
5. 运行与改动范围相称的验证，最后执行 `pnpm verify:fast`。
6. 完成复杂计划后移入 `docs/exec-plans/completed/` 并记录验证结果。

复杂改动指 API、Schema、数据库、架构边界或跨多个 package 的变更。

## 5. Commands

```bash
pnpm harness:check   # 架构、文档、配置、安全、代码形态
pnpm verify:fast     # harness + lint + typecheck + deterministic eval
pnpm verify          # format + fast checks + all tests + build
pnpm eval            # Mock 模式的核心 Agent 行为评估
pnpm diagnose:project -- <project-id> # 脱敏项目诊断
```

真实 Baishan 测试必须显式设置 `RUN_REAL_BAISHAN_STREAM=1`，默认 CI 不产生模型费用。

## 6. Code And Review

- 依赖选择顺序：复用现有实现 -> 平台/标准库 -> 成熟社区依赖 -> 自行实现。
- 对协议解析、安全、认证、并发控制等复杂通用能力，成熟且维护活跃的社区依赖通常优于自行实现；不得以“零依赖”为目标重复造轮子。
- 新增依赖前说明解决的问题、现有方案为何不足，以及维护状态、安全、许可证、运行时或前端体积影响；简单逻辑和预留能力不为此引入依赖。
- 禁止 `any`、`@ts-ignore`、`eval`、`console.log`、硬编码密钥和无错误处理的 Prisma/LLM 调用。
- 生产文件目标不超过 200 行，函数不超过 50 行，参数不超过 3 个；存量豁免只能缩小。
- 修 bug 必须补回归测试；Review 优先关注边界、异步、并发、类型、安全和行为回退。
- 不执行破坏性 Git 命令，不撤销与任务无关的用户修改。

## 7. Tool Notes

- `CLAUDE.md` 只保留入口，不复制规则。
- `.claude/skills/` 只保留 Claude 适配层，通用正文位于 `docs/playbooks/`。
- `.claude/settings.local.json` 和 `.env` 是本机文件，禁止提交。
- 工具自身使用 MCP 不等于把 MCP 引入本项目运行时。
