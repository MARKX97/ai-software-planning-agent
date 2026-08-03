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
- **Fact:** 当前可运行产品是 V2 确定性工作流加 V3 P0 知识证据闭环；Markdown/TXT、混合检索、PRD/Architecture 引用和最小 UI 已交付，LangGraph、PDF/仓库与动态 Tool 仍为 Planned。
- **Evidence:** [`product-vision.md`](./product-vision.md)、[`architecture-overview.md`](./architecture-overview.md)、[`v3-rag-agent.md`](./exec-plans/completed/v3-rag-agent.md)。
- **Impact:** 对外说明可以描述 V3 P0，但不得宣称 LangGraph、仓库感知、运行时 Tool 或完整 V3 已交付；后续阶段继续遵循 contract-first。

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

## Superseded Memory

暂无。失效条目移入此处，并注明替代它的权威文档或 Active Memory ID。
