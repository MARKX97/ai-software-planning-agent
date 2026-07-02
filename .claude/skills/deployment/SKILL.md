---
name: deployment
description: Deployment guide — Docker, Docker Compose, environment variables, database migration, CI/CD, logging, monitoring, backup, disaster recovery, cost control.
triggers:
  - deploying
  - docker
  - docker compose
  - CI/CD
  - environment variables
  - database migration
  - backup
  - disaster recovery
  - monitoring
  - logging
  - cost control
  - production
---

# Deployment Guide

> Load: 部署时

## 1. 环境对比

| 维度 | 本地开发 | 测试环境 | 生产环境 |
|------|----------|----------|----------|
| 部署方式 | `pnpm dev` | Docker Compose | Docker Compose |
| 数据库 | 本地 PostgreSQL | Docker PostgreSQL | Docker PostgreSQL |
| 日志级别 | DEBUG | INFO | WARN |
| 认证 | 可选 | 必选 | 必选 |
| 监控 | 无 | 基础 | 完整 |
| 备份 | 无 | 手动 | 自动 |

## 2. 本地开发

```bash
pnpm install
cp .env.example .env
docker compose -f docker/docker-compose.dev.yml up -d postgres
pnpm db:migrate
pnpm db:seed
pnpm dev
# Web: http://localhost:3000, API: http://localhost:3001
```

前置: Node.js 18+, pnpm 9, PostgreSQL 16, Docker Desktop 26+

## 3. Docker 设计

原则: 多阶段构建、Alpine 基础镜像、非 root 用户、HEALTHCHECK

```
docker/
├── Dockerfile.api              # API 镜像
├── Dockerfile.web              # Web 镜像
├── docker-compose.dev.yml      # 本地开发
├── docker-compose.test.yml     # 测试环境
├── docker-compose.prod.yml     # 生产环境
└── nginx.conf
```

## 4. Docker Compose

### 卷

| 卷名 | 用途 | 持久化 |
|------|------|--------|
| `pgdata` | PostgreSQL 数据 | 是 |
| `artifacts` | 产物文件 | 是 |

### 健康检查

| 服务 | 检查 | 间隔 | 超时 | 重试 |
|------|------|------|------|------|
| web | `curl localhost:3000` | 30s | 10s | 3 |
| api | `curl localhost:3001/api/v1/health` | 30s | 10s | 3 |
| postgres | `pg_isready` | 10s | 5s | 5 |

## 5. 环境变量

| 分类 | 变量 | 必须 |
|------|------|------|
| 数据库 | `DATABASE_URL` | 是 |
| LLM API | `BAISHAN_BASE_URL`, `BAISHAN_API_KEY` | 是 |
| LLM API | `BAISHAN_MODEL_DEEPSEEK/GLM/MINIMAX` | 否 |
| 应用 | `API_PORT`, `WEB_PORT`, `API_KEY`, `DATA_DIR`, `LOG_LEVEL` | 否 |
| 成本 | `COST_MAX_TOKENS_PER_PROJECT`, `COST_MAX_COST_PER_PROJECT` | 否 |

安全: .env 加入 .gitignore、生产 API Key 90 天轮换、不记录 API Key 到日志、数据库密码 > 16 位、生产端口仅绑定 127.0.0.1

## 6. 数据库迁移

```
开发: prisma migrate dev → 生成迁移文件
测试: prisma migrate deploy（自动）
生产: 先备份 → prisma migrate deploy → 验证
```

规范:
- ✅ 迁移文件提交 Git、新增字段设 DEFAULT 或 NULL、生产迁移前备份
- ❌ 禁止手动修改已提交迁移、禁止生产执行 `prisma migrate dev`、禁止删除字段（标记 `@deprecated` 等 MAJOR）

## 7. CI/CD

```
Push/PR → Lint & Type Check → Test → Build → Deploy
```

| 事件 | 目标 | 触发 |
|------|------|------|
| Push to develop | 测试环境 | 自动 |
| Merge to main | 生产 | 手动 |
| Tag v* | 生产 | 手动 |

## 8. 日志与监控

- 框架: pino（结构化 JSON）
- 存储: stdout → Docker logs → 日志文件，每天轮转，保留 30 天

| 级别 | 场景 |
|------|------|
| ERROR | 需立即关注 |
| WARN | 潜在问题 |
| INFO | 关键业务事件 |
| DEBUG | 调试信息 |

告警阈值: API 连续 3 次失败、数据库不可用、3 个 Provider 全部 unhealthy、单项目成本 > ¥5.00、磁盘 > 80%

## 9. 备份策略

| 备份项 | 方式 | 频率 | 保留 |
|--------|------|------|------|
| PostgreSQL | `pg_dump` | 每天 03:00 | 7 天 |
| 产物文件 | 文件同步 | 每天 04:00 | 7 天 |
| 环境变量 | 手动备份 | 变更时 | 永久 |
| Docker 配置 | Git | 每次变更 | 永久 |

## 10. 灾难恢复

| 故障 | 恢复方案 | RTO | RPO |
|------|----------|-----|-----|
| API 进程崩溃 | Docker 自动重启 | < 1 分钟 | 0 |
| PostgreSQL 宕机 | 重启容器 + 恢复备份 | < 5 分钟 | < 24h |
| 磁盘故障 | 恢复最新备份 | < 30 分钟 | < 24h |
| 服务器宕机 | 新服务器部署 + 恢复备份 | < 1 小时 | < 24h |

## 11. 成本控制

| 成本项 | 估算/月 |
|--------|---------|
| 云服务器 (2C2G) | ¥50-100 |
| 数据库存储 | ¥10-20 |
| 备份存储 | ¥5-10 |
| LLM API 调用 | ¥0.167/项目 |
| **合计（不含 LLM）** | **¥70-140** |

## 12. 常用运维命令

```bash
docker compose -f docker/docker-compose.prod.yml ps
docker compose -f docker/docker-compose.prod.yml logs -f --tail=100 api
docker compose -f docker/docker-compose.prod.yml restart api
docker compose -f docker/docker-compose.prod.yml exec api sh
docker compose -f docker/docker-compose.prod.yml exec postgres \
  psql -U postgres -d ai_planning_agent \
  -c "SELECT project_id, total_cost FROM token_usage ORDER BY total_cost DESC LIMIT 10;"
```
