---
name: development-phase-2
description: Phase 2 — Database, Prisma Schema, migrations, seed data.
triggers:
  - Phase 2
  - database
  - Prisma
  - migration
  - schema
---

# Phase 2 — Database

## 目标

实现 Prisma Schema（11 表），生成迁移，编写种子数据。

## 核心交付

1. `packages/database/prisma/schema.prisma`（11 表，snake_case 复数，UUID 主键，TIMESTAMPTZ）
2. `prisma migrate dev` 生成迁移文件
3. `prisma/seed.ts` 种子数据
4. `packages/database/src/client.ts` 导出 PrismaClient 单例

## 验收

```bash
pnpm db:migrate && pnpm db:seed
```
