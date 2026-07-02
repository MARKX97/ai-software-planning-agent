---
name: development-phase-3
description: Phase 3 — API, NestJS controllers, DTOs, Swagger, RESTful routes.
triggers:
  - Phase 3
  - API
  - controller
  - DTO
  - Swagger
---

# Phase 3 — API

## 目标

搭建 NestJS 11 基础，实现 Controller + DTO + Swagger 文档。

## 核心交付

1. NestJS 模块化项目结构（modules/）
2. Controller（RESTful，`/api/v1/`）
3. Zod DTO 校验
4. Swagger/OpenAPI 文档
5. 统一错误格式 `{ error: { code, message, details } }`

## 验收

所有接口返回 200/201，Swagger 页面可访问。
