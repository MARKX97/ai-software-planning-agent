---
name: testing
description: Testing strategy, frameworks, coverage targets, test types, mock provider, CI setup for this project.
triggers:
  - writing tests
  - running tests
  - test coverage
  - debugging a failing test
  - setting up CI
  - mock LLM provider
  - test pyramid
  - golden dataset
---

# Testing Strategy

> Load: 编写测试时

## 1. 测试金字塔

```
         ┌───────┐
         │  E2E  │  ← 10 tests (Playwright)
         ├───────┤
         │  API  │  ← 26 tests (Supertest + OpenAPI)
         ├───────┤
         │  Int  │  ← 20 tests (Jest + PostgreSQL)
         ├───────┤
         │ Unit  │  ← 100+ tests (Jest/Vitest)
         └───────┘
```

## 2. 测试框架

| 层           | 工具                   |
| ------------ | ---------------------- |
| 后端单元测试 | Jest 30                |
| 后端集成测试 | Jest + Supertest       |
| 前端单元测试 | Vitest                 |
| 前端组件测试 | @testing-library/react |
| E2E          | Playwright             |
| API 契约测试 | OpenAPI Validator      |
| LLM Mock     | MockLLMProvider        |

## 3. 覆盖率目标

| 包                               | 目标 |
| -------------------------------- | ---- |
| `packages/llm-core`              | 90%+ |
| `packages/llm-providers`         | 85%+ |
| `packages/llm-orchestrator`      | 85%+ |
| `apps/api/src/modules/workflow`  | 80%+ |
| `apps/api/src/modules/synthesis` | 80%+ |
| `apps/api/src/modules/artifact`  | 80%+ |
| `apps/api/src/modules`（其他）   | 70%+ |
| `apps/web`                       | 70%+ |

## 4. 测试类型

### Unit Test

覆盖: cost-calculator, schema-validator, retry-policy, response-parser, baishan-adapter, base-provider, provider-registry, retry.strategy, cost-controller, call-tracker, stage.ts, cost.ts, workflow-state-machine, conflict-resolver, token-tracker, 前端组件

### Integration Test

覆盖: Project CRUD, Conversation + Message, Workflow + Stages, Prisma + PostgreSQL, Orchestrator + Mock Providers。所有集成测试使用真实 PostgreSQL（CI 中 Service Container）

### API Test

26 个接口，每个 ≥ 3 个用例（正常/异常/边界）。Supertest + OpenAPI 契约校验

### Workflow Test

状态机（17 条合法 + 非法转换）、9 个阶段（Mock LLM）、澄清循环（多轮 + 上限）、降级路径（1/2/3 模型失败）、错误恢复

### LLM Mock Test

`MockLLMProvider` 支持 fail/timeout/delay 控制，覆盖: 正常/超时/单模型失败/全模型失败/Schema 校验失败/高延迟/成本超限

### Prompt Regression Test

变量完整性、长度检查（< 8,000 字符）、结构检查、Snapshot 快照

### Artifact Generation Test

11 类产物全部生成、格式正确、内容非空、文件存储正确、部分失败不影响其他产物

### E2E Test

Playwright 覆盖: 完整工作流（创建→运行→澄清→等待→验证产物）、前端 UI 交互

## 5. Mock Provider

```typescript
class MockLLMProvider implements ILLMProvider {
  shouldFail = false;
  shouldTimeout = false;
  delayMs = 0;
  mockResponse = {};
}
```

## 6. Golden Dataset

3 个标准测试用例:

1. Todo app — 简单项目
2. 协作平台 — 复杂项目
3. 饮水追踪 — 移动端项目

每个用例含: 预期摘要、目标用户、核心问题、需求数量、关键词、平台方向、风险类别

## 7. CI 测试

```yaml
jobs:
  unit-test: # 6 个包并行
  integration-test: # PostgreSQL Service Container
  api-contract-test: # OpenAPI 契约校验
  prompt-regression: # Prompt 快照
  architecture-check: # 禁止技术检查
```

## 8. Release 验证

```
□ 全量测试通过    □ 覆盖率达标    □ API 契约验证
□ Prompt 快照验证  □ 架构漂移检查  □ 数据库迁移无待处理
□ 构建验证        □ 环境变量检查  □ 文档更新    □ 冒烟测试
```

## 9. 测试文件命名

```
源文件                             → 测试文件
src/service.ts                     → src/service.spec.ts
src/service.ts                     → tests/service.integration.spec.ts
src/modules/project/controller.ts  → tests/project.e2e-spec.ts
apps/web/src/components/card.tsx   → tests/card.test.tsx
```

## 10. 运行命令

```bash
pnpm test                     # 全量
pnpm test -- --coverage       # 覆盖率
pnpm test -- --watch          # 监听
pnpm test:e2e                 # E2E
pnpm test:api                 # API 契约
pnpm test -- --updateSnapshot # 更新快照
```
