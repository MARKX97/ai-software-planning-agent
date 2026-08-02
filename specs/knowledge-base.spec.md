# Project Knowledge Base — Proposed Contract

> Version: 0.1.0
> Status: Proposed for V3
> Owner: Backend Lead + AI Infrastructure Lead

## 1. 目标与非目标

项目知识库为软件规划提供用户自己的文档和代码证据。它负责导入、解析、索引、检索和引用，不负责工作流推进、权限判断或自动修改代码。

V3 支持：

- Markdown、TXT、PDF 上传。
- 公开 `github.com` 仓库导入，并固定到解析后的 commit SHA。
- 项目内混合检索和可追溯引用。

V3 不支持私有仓库凭据、任意 URL 抓取、网页搜索、OCR、跨项目知识共享和独立向量数据库。

## 2. 用户行为

1. 用户为项目创建知识源。
2. 系统验证来源并记录 `pending` 状态。
3. 索引流程执行解析、规范化、切片、Embedding 和写入。
4. 用户查看 `processing`、`ready`、`ready_with_warnings` 或 `failed` 状态及脱敏原因。
5. 用户可重新索引或删除知识源；删除后该来源不得参与新检索。
6. 已生成产物保留生成时的引用快照，不因知识源删除而失去审计信息。

## 3. 来源与限制

| 来源     | 输入                                      | 默认限制                                                           |
| -------- | ----------------------------------------- | ------------------------------------------------------------------ |
| 文件上传 | `.md`, `.txt`, `.pdf`                     | 单文件 20 MiB；拒绝空文件和不匹配的 MIME                           |
| 公开仓库 | `https://github.com/<owner>/<repository>` | 仅 HTTPS 和 `github.com`；最多 2,000 个文本文件、50 MiB 可索引文本 |

仓库索引必须忽略二进制文件、符号链接逃逸、`.git`、依赖目录、构建产物、锁文件和高置信度密钥文件。服务端不得接受仓库 Token，也不得跟随到非允许域名，防止 SSRF。

所有来源使用 SHA-256 内容 hash。相同项目、来源和 revision 的重复请求必须复用已有结果或返回冲突，不得产生重复 Chunk。

## 4. 索引生命周期

```text
pending -> processing -> ready
                      -> ready_with_warnings
                      -> failed
ready / ready_with_warnings / failed -> processing (reindex)
any non-processing state -> deleted
```

- 单文档解析失败时保留其他成功文档并标记 `ready_with_warnings`。
- 来源完全不可读、Embedding 全部失败或事务提交失败时标记 `failed`。
- 重建索引先写入新 revision；完整成功后原子切换 active revision，失败时继续使用旧 revision。
- `processing` 状态不参与检索。

## 5. 文档、Chunk 与 Embedding

每个规范化文档至少记录：`source_id`、逻辑路径、标题、MIME、revision、content hash 和解析元数据。

Chunk 规则：

- 优先按 Markdown 标题、PDF 页和代码文件边界切分，再按 Token 上限拆分。
- 默认目标 800 tokens、重叠 120 tokens；不得跨文件合并。
- 每个 Chunk 保存稳定顺序、标题路径、页码或代码行范围和内容 hash。
- Embedding 维度由配置的模型决定；切换模型或维度必须创建新 revision 并完整重建。

Embedding 使用独立 Provider 配置，不默认复用白山 Chat 模型。默认测试只使用固定向量 Mock。

## 6. 存储与检索

- 继续使用 PostgreSQL 16；向量列由 `pgvector` 提供。
- Prisma 管理来源、文档、状态和元数据；向量相似度查询集中在数据库包的单一 Repository 中，必须使用参数化 Raw SQL。
- 每次查询必须包含 `project_id` 和 active revision 过滤，禁止先全局检索再在应用层过滤。
- 向量检索和 PostgreSQL 全文检索各取最多 20 条，使用 Reciprocal Rank Fusion 合并，最终返回最多 8 条。
- 初版不使用 LLM Reranker；只有离线评测证明召回不足时才新增。

检索无结果时返回空数组和 `insufficient_evidence=true`，不得伪造来源。知识库不可用时，现有 V2 工作流可以降级继续，但产物必须标记未使用项目证据。

## 7. 引用契约

```typescript
type EvidenceCitation = {
  sourceId: string;
  documentId: string;
  chunkId: string;
  title: string;
  locator: string;
  excerpt: string;
  contentHash: string;
};
```

- 产物正文使用 `[S1]`、`[S2]` 等稳定编号。
- 引用只允许指向本次 Graph Run 实际检索并提供给模型的 Chunk。
- `excerpt` 是生成时快照，必须限制长度并经过敏感信息检测。
- 引用编号、正文标记和结构化引用列表必须一一对应；缺失或多余引用使质量检查失败。

## 8. 安全与审计

- 文档、仓库内容、路径和提交信息全部视为不可信输入，并放入明确的 `untrusted-context` 边界。
- 来源中的指令不能改变系统 Prompt、工具白名单、项目 ID、工作流状态或数据库操作。
- 工具参数使用 Zod 校验；路径读取必须限定在已索引来源内并拒绝 `..`、绝对路径和符号链接逃逸。
- 日志记录 `project_id`、`source_id`、revision、处理结果、Chunk 数和耗时，不记录完整文档、Embedding 或密钥。

## 9. Proposed API

以下接口在 V3 实施阶段同步到 `contracts/openapi.yaml`；当前不属于已交付 API。

| Method | Path                                                           | 行为               |
| ------ | -------------------------------------------------------------- | ------------------ |
| POST   | `/projects/{project_id}/knowledge/sources`                     | 创建上传或仓库来源 |
| GET    | `/projects/{project_id}/knowledge/sources`                     | 列出来源与状态     |
| POST   | `/projects/{project_id}/knowledge/sources/{source_id}/reindex` | 重建索引           |
| DELETE | `/projects/{project_id}/knowledge/sources/{source_id}`         | 删除来源           |
| POST   | `/projects/{project_id}/knowledge/search`                      | 预览项目内检索     |

## 10. 验收与失败场景

- 相同输入重复索引产生相同 Chunk 顺序和 hash。
- 任意检索结果均属于请求项目和 active revision。
- 解析部分失败保留成功内容并返回 warning；完全失败不替换旧索引。
- Embedding 超时、限流和无效维度返回脱敏错误，不留下半套 active revision。
- 删除来源后新检索不可命中，历史产物引用快照仍可查看。
- 恶意 Prompt、路径穿越、重定向到非允许域名和疑似密钥文件均被拒绝或隔离。

## 11. 版本边界

本规格为 Proposed。数据库模型、OpenAPI、Zod 类型和实现必须在对应实施阶段先更新机器契约，再写代码。
