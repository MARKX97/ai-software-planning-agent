# Project Memory

> Status: Current
> Last reviewed: 2026-08-03

本文件是开发 Agent 的项目级长期记忆，保存跨任务仍然成立、但不适合成为产品契约的已验证事实。完整知识地图见 [`README.md`](./README.md)。

## Read And Write Protocol

- 每次任务开始时读取 `Active Memory`，再按知识地图加载相关权威文档。
- 只记录能影响后续判断、避免重复排查或阻止错误声明的持久事实。
- 每条记忆必须包含状态、最近验证日期、证据和影响；没有证据的内容只能留在任务计划中。
- 产品行为、架构规则和操作流程应先写入对应 spec、contract 或 playbook；Memory 只链接，不复制完整规则。
- 事实失效时更新原条目并移入 `Superseded Memory`，不得保留互相矛盾的 Active 条目。
- 禁止记录密钥、个人数据、原始 Prompt/日志、完整对话、未验证推测和临时任务进度。

## Active Memory

### MEM-001 Current Delivery Baseline

- **Status:** Active
- **Last verified:** 2026-08-03
- **Fact:** 当前可运行产品是 V2 用户可见工作流加 V3 P0/P1；Markdown/TXT/PDF、公开 GitHub snapshot、混合检索与引用、持久化 LangGraph 恢复和 V2 runner 回退已交付，动态 Tool 与增量重生成仍为 Planned。
- **Evidence:** [`product-vision.md`](./product-vision.md)、[`architecture-overview.md`](./architecture-overview.md)、[`v3-p1-repository-graph.md`](./exec-plans/completed/v3-p1-repository-graph.md)。
- **Impact:** 对外说明可以描述 V3 P0/P1，但不得宣称运行时 Tool、私有仓库或 P2 增量重生成已交付；后续阶段继续遵循 contract-first。

### MEM-002 Real Model Verification Boundary

- **Status:** Active
- **Last verified:** 2026-08-03
- **Fact:** 默认测试和 CI 使用 Mock；当前不能以默认绿色测试声称真实白山端到端已完整跑通。
- **Evidence:** [`testing.md`](./playbooks/testing.md) 中真实调用需要显式设置 `RUN_REAL_BAISHAN_STREAM=1`。
- **Impact:** 交付说明必须明确 Mock/Real；只有保存了显式真实调用的验证结果后才能更新此结论。

### MEM-003 Local Corepack Compatibility

- **Status:** Active
- **Last verified:** 2026-08-03
- **Fact:** 当前 Node.js 20.13 环境自带的 Corepack 0.28.0 无法验证项目固定的 pnpm 10.19.0 签名；Corepack 0.34.0 + pnpm 10.19.0 已验证可正常运行 Husky 和 push gate。
- **Evidence:** 根目录 [`package.json`](../package.json) 的 `packageManager` 固定为 `pnpm@10.19.0`。
- **Impact:** 再遇到 `Cannot find matching keyid` 时升级与当前 Node 兼容的 Corepack，不绕过 Git hooks，不修改项目 pnpm 版本规避问题。

### MEM-004 Mermaid Compatibility

- **Status:** Active
- **Last verified:** 2026-08-03
- **Fact:** GitHub Mermaid 会把 `graph` 解析为保留关键字，不能将其用作节点 ID；`agentGraph` 已通过 Mermaid 11.12 实际渲染。
- **Evidence:** [`system-design.md`](./system-design.md) 的主流程图。
- **Impact:** 修改 Mermaid 后必须实际解析全部图表，不能只依赖 Markdown 格式检查。

### MEM-005 Docker Dependency Cache Boundary

- **Status:** Active
- **Last verified:** 2026-08-03
- **Fact:** 当前 Dockerfile 在 `pnpm install` 前执行 `COPY . .`，任何源码变化都会使依赖层缓存失效；P1 最终构建因此重新下载完整 894 包依赖树，而不是新增了 894 个依赖。
- **Evidence:** 根目录 [`Dockerfile`](../Dockerfile) 的 base stage 与本次 P1 生产镜像构建日志。
- **Impact:** 功能开发阶段不得反复重建 Docker；后续单独优化 manifest/dependency layer 与 pnpm store cache 后，才恢复频繁镜像验证。

## Superseded Memory

暂无。失效条目移入此处，并注明替代它的权威文档或 Active Memory ID。
