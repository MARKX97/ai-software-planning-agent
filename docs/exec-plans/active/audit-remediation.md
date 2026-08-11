# Audit Remediation Plan

> Status: Active — implementation complete, awaiting CI runtime gates  
> Started: 2026-08-11  
> Source: [`2026-08-11-project-audit.md`](../../reviews/2026-08-11-project-audit.md)

## Goal

按 AUD-01 至 AUD-15 的编号顺序修复审查发现，保持 V2/V3 行为兼容，并为每个故障、并发或安全边界补可重复的回归证据。

## Constraints

- 继续保持单体、单 Agent、现有 Orchestrator 与 PostgreSQL/Prisma 边界。
- 不引入 Redis、队列、微服务、运行时 MCP 或新的第三方依赖。
- 文档、contract、migration、实现和测试同步更新。
- 每项完成后更新源审查报告状态；全部实现完成后统一执行完整 release gates。
- 默认验证使用 Mock，不调用真实 Baishan、Embedding 或在线 GitHub。

## Sequence

| Order | Item                                        | Exit evidence                                                   | Status    |
| ----- | ------------------------------------------- | --------------------------------------------------------------- | --------- |
| 1     | AUD-01 Graph failed resume 与节点副作用幂等 | crash/replay 测试不重复 durable side effects，failed run 可恢复 | Completed |
| 2     | AUD-02 Tool logical attempt                 | 业务重入执行新 Tool，checkpoint replay 复用同 attempt           | Completed |
| 3     | AUD-03 首次 run 失败可重启                  | HTTP 回归：持久化失败状态后同项目 run 成功                      | Completed |
| 4     | AUD-04 首次 run 原子 claim                  | PostgreSQL 并发测试仅一个 execution 获得 claim                  | Completed |
| 5     | AUD-05 resume claim 故障恢复                | claim 后失败不锁死 checkpoint                                   | Completed |
| 6     | AUD-06 reindex 失败回退                     | 失败后、repair 前仍检索旧 active chunk                          | Completed |
| 7     | AUD-07 增量重生成部分失败                   | 失败目标继续保留在 regeneration impact                          | Completed |
| 8     | AUD-08 产物事务替换                         | create 失败时旧 active artifact 不变                            | Completed |
| 9     | AUD-09 限流身份与容量                       | 无鉴权 header 不绕过；bucket 有硬容量                           | Completed |
| 10    | AUD-10 知识处理资源上限                     | 页数/字符/chunk/并发边界测试                                    | Completed |
| 11    | AUD-11 完整 secret 扫描                     | 4 KiB 后的凭据文件被排除                                        | Completed |
| 12    | AUD-12 审计内容最小化                       | 默认不存/不返回完整 Prompt 与响应，contract 对齐                | Completed |
| 13    | AUD-13 Tool running claim                   | 并发同 key 仅一个实际读取                                       | Completed |
| 14    | AUD-14 回退开关验证                         | V2 runner 与 P1 Graph 的完整 Mock HTTP 流程                     | Completed |
| 15    | AUD-15 CORS 与本地监听                      | 配置化 Origin；无鉴权仅 loopback                                | Completed |

## Final Gates

```bash
pnpm verify
RUN_REAL_INTEGRATION=1 pnpm --filter @ai-planning/api test
pnpm --filter @ai-planning/web test:e2e
```

Docker 和真实模型 smoke 不属于逐项反馈循环；仅在全部代码完成后按用户确认的统一验证策略执行。

## Validation Result

- `pnpm verify`：通过（format、harness、全仓 lint/typecheck、单测、生产 build）。
- API：159 pass、9 个环境型 integration skip；Web：38 pass。
- AUD-01 追加验证：模型日志与 Token 汇总同事务；clarification/review checkpoint 消息幂等，review 会话与首条消息同事务；Graph replay 聚焦用例 8/8 通过。
- AUD-03 追加真实 HTTP+PostgreSQL 回归：同项目处于初次失败恢复产生的 `failed/failed` 持久状态时，重新 `/run` 必须进入 active clarification；用例已纳入环境型集成套件。
- 复用本机已有 Docker 镜像、且不映射宿主端口执行 PostgreSQL 门禁：6 个新增 migration 实际 deploy 成功；Graph 重启恢复、并发启动 claim、resume 事务回滚共 3/3 通过。
- P1/V2 HTTP 回退与 Playwright E2E 已纳入 CI；本机无现成 API/Web 进程，按端口约束未在本轮启动，CI 通过后再归档本计划。
- CI 运行时门禁发现 P2 增量重生成在缺失 `planning_generation` 状态行时返回 500；修复标准是待重生影响使用 upsert 持久化，并补缺行回归。
- `docker compose config --quiet`：通过；未执行 Docker build，也未下载依赖。
