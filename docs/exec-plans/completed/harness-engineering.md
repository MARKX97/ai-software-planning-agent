# Harness Engineering Constraint Upgrade

> Status: Completed

## Goal

把分散在 Agent 文档中的项目规则变成 Codex/Claude 共用、可发现、可执行且能在 CI 阻止回退的工程约束。

## Decisions

- `AGENTS.md` 只做知识地图，通用正文位于 `docs/`。
- 保留直接 push 工作流，不引入 PR-only 门禁。
- 使用 Node 标准库和现有 ESLint，不新增依赖。
- 代码形态采用精确基线渐进收紧；新增或扩大的违规会失败。
- Mock 评估默认无付费调用，真实白山测试继续显式启用。

## Contract Impact

不修改产品 API、数据库 Schema 和用户流程。新增的命令只用于开发、CI、评估和只读诊断。

## Delivered

- 知识索引、通用 playbook、执行计划和技术债台账。
- 架构、LLM 白名单、文档、配置、安全和代码形态检查。
- `harness:check`、`verify:fast`、`verify`、`eval`、`diagnose:project`。
- pre-push 和 GitHub Actions 门禁。

## Validation

- `pnpm harness:check`：通过，包含 4 个 Harness parser 测试。
- `pnpm eval`：通过；真实白山和真实 HTTP 用例按默认开关跳过。
- `pnpm verify`：format、Harness、lint、typecheck、全量测试和 production build 通过。

方案依据：[OpenAI Harness Engineering](https://openai.com/index/harness-engineering/)。
