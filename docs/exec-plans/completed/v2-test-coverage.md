# V2 Test Coverage Completion

> Status: Completed
> Scope: Current V2 only

## Goal

补齐当前 V2 中尚未覆盖的分支、数据隔离、错误处理和关键用户路径，不为 Planned V3 或无行为代码创建空壳测试。

## Completed Work

1. API services：补 Projects、Conversations、Usage、Models、Health 与 AppConfig 的成功、筛选、聚合、归属和失败分支。
2. Shared behavior：补敏感文本、DTO mapper、Workflow guard/interaction/failure 等纯逻辑边界。
3. Database tooling：提取并测试项目诊断输出的脱敏与截断逻辑；不重复测试 Prisma Client。
4. Web behavior：补项目列表、Artifact 下载、Workflow action 和格式/状态映射中的异步与错误分支。
5. E2E：保留完整 Workflow 路径，新增项目创建/筛选/删除、表单校验和 API error/retry 用户路径。

## Non-Goals

- V3 Knowledge、RAG、LangGraph 或 Tool 测试；对应实现尚不存在。
- re-export、常量、Nest 模块声明、纯样式组件和 Prisma 生成代码的形式化覆盖。
- 真实白山模型调用或默认付费测试。

## Verification Results

- `pnpm verify`：通过，包括 format、Harness、Lint、Typecheck、Mock 测试和 Build。
- API HTTP + PostgreSQL integration：101/101 通过，无跳过。
- Web Vitest：13 个文件、31/31 通过。
- Database Node Test：2/2 通过。
- Playwright：Chromium、Firefox、WebKit 共 15/15 通过。
- 模型调用保持 Mock；未产生真实白山费用。

## Rollback

测试文件可独立回滚；生产代码只为可测试性提取无行为变化的纯函数。
