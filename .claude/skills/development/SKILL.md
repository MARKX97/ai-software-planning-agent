---
name: development
description: Development supplement — actionable review commands, drift prevention, and scope creep control. Core rules live in CLAUDE.md.
triggers:
  - implementing a feature
  - writing code
  - creating a new module
  - code review
  - checking architecture drift
  - scope creep prevention
---

# Development Supplement

> 核心规范见 CLAUDE.md（MVP First、Tech Stack、LLM 铁律、目录约束、代码规范、Self-Check 等）。
> 本文件仅补充 CLAUDE.md 未覆盖的操作性内容。

## 1. 提交前 Review

```
□ pnpm test   □ pnpm lint   □ pnpm build
□ 新依赖？ □ 修改了契约？ □ 新增了数据库迁移？ □ MVP 范围外功能？
```

## 2. 违规扫描

```bash
grep -r "from 'openai'" apps/api/src/              # 应为空
grep -r "DeepSeekProvider\|GLMProvider" apps/api/src/modules/  # 应为空
grep -r "redis\|kafka\|langchain" apps/ packages/   # 应为空
grep -r ": any" apps/api/src/ --include="*.ts"      # 应 < 5
```

## 3. 回归验证

```bash
pnpm test        # 全量测试
pnpm build       # 全量构建
pnpm lint        # 全量 Lint
pnpm db:migrate  # 无待处理迁移
curl localhost:3001/api/v1/health  # {"status":"ok"}
```

## 4. 架构漂移防御

- CI 中运行架构漂移检查
- 每 2 周抽查 3 个文件
- 偏离设计时写 ADR

## 5. 需求变更流程

```
1. 提出 Issue → 2. 团队讨论 → 3. 更新 product-vision.md
→ 4. 更新设计文档 → 5. 更新 contracts/ → 6. 实现
```
