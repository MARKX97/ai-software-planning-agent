---
name: development-phase-7
description: Phase 7 — Workflow Engine, state machine, 9 stages.
triggers:
  - Phase 7
  - workflow
  - state machine
  - stage
---

# Phase 7 — Workflow Engine

## 目标

实现 WorkflowStateMachine + 9 个阶段处理器。

## 核心交付

1. WorkflowStateMachine（20 条合法转换 + 非法转换拒绝）
2. 9 个 Stage 处理器（按 `specs/workflow.spec.md` 定义）
3. 澄清循环（多轮 + 上限）
4. 降级路径（1/2/3 模型失败）

## 验收

工作流启动→完成，所有阶段按序执行。
