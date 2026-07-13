# Product Vision

> Version: 1.0.0
> Status: Product Source of Truth

---

## 产品定位

AI Software Planning Agent 是一个**软件规划 Agent**，帮助用户将模糊的软件想法逐步收敛为可执行的软件项目方案。

**本产品不是代码生成工具。**

## 核心目标

帮助用户回答：

1. 这个项目值得做吗
2. 用户是谁
3. 风险是什么
4. MVP 是什么
5. 应该做成什么平台
6. 如何开始开发

## 用户类型

### 独立开发者

- 特点：时间有限、预算有限
- 目标：快速验证项目想法

### AI Coding 用户

- 特点：使用 Claude Code / Cursor / Codex
- 目标：获得高质量开发上下文

### 创业者

- 目标：验证商业想法

## 核心流程

```
Idea → Requirement Analysis → Requirement Clarification
→ Multi Model Analysis → Requirement Synthesis
→ Feasibility Analysis → Risk Analysis → MVP Compression
→ Platform Recommendation → Planning Generation
```

需求澄清、需求范围、MVP 取舍和技术方案是用户可参与的检查点。用户可在每个检查点与 Agent 多轮讨论，确认后才推进到下一环节；讨论结论会进入后续分析和最终规划。

## 多模型分析

多模型分析阶段使用 GLM-5.1 / DeepSeek-V4-Pro / MiniMax-M2.5 三个模型并行分析。

## 输出内容

- Requirement Report, Feasibility Report, Risk Report
- MVP Plan, Platform Recommendation, Project Plan
- PRD, Architecture, Frontend Spec, Backend Spec, AI Coding Rules

## MVP 范围

### 第一版必须支持

- 多轮需求沟通与关键检查点确认
- 多模型分析
- 需求融合
- 风险分析
- MVP 收缩
- 平台推荐
- 项目规划生成
- Web UI（创建项目、工作流进度、检查点讨论、产物查看与导出）

### 第一版不支持

- RAG, MCP, Auto Coding, Auto Deploy, Multi-Agent
- 用户系统、RBAC、支付系统
