# Frontend — System Contract

> Version: 1.0.0
> Status: Contract
> Owner: Frontend Lead
> Tokens: ~7,000

---

## 1. 范围

第一版包含 Web UI。Web UI 是用户创建项目、完成需求澄清、查看工作流进度、阅读/导出产物的主要入口。

不包含:

- 用户注册/登录页
- RBAC/团队协作
- WebSocket 实时推送
- 在线富文本编辑器
- 支付/订阅
- Auto Coding / Auto Deploy

## 2. 技术栈

| 层         | 技术                                  |
| ---------- | ------------------------------------- |
| 框架       | Next.js 15 App Router                 |
| 语言       | TypeScript 5.5+                       |
| 样式       | Tailwind CSS 4.x                      |
| UI         | shadcn/ui                             |
| 数据请求   | TanStack Query                        |
| 表单       | React Hook Form + Zod                 |
| API Client | `apps/web/src/lib/api-client.ts`      |
| 测试       | Vitest + Testing Library + Playwright |

## 3. 路由

| 路由                                           | 页面                | 说明                           |
| ---------------------------------------------- | ------------------- | ------------------------------ |
| `/`                                            | DashboardPage       | 项目列表、创建入口、最近项目   |
| `/projects/new`                                | NewProjectPage      | 创建项目表单                   |
| `/projects/[projectId]`                        | ProjectOverviewPage | 项目详情、当前阶段、快捷操作   |
| `/projects/[projectId]/workflow`               | WorkflowPage        | 工作流进度、澄清对话、阶段状态 |
| `/projects/[projectId]/artifacts`              | ArtifactsPage       | 产物列表                       |
| `/projects/[projectId]/artifacts/[artifactId]` | ArtifactDetailPage  | 产物详情、下载                 |
| `/projects/[projectId]/usage`                  | UsagePage           | Token 用量、模型调用日志       |

## 4. 页面行为

### 4.1 DashboardPage

API:

- `GET /projects?offset=&limit=&status=`
- `DELETE /projects/{project_id}`

状态:

- loading: 显示项目列表骨架屏
- empty: 显示创建项目入口
- error: 显示错误提示与重试按钮

交互:

- 分页加载项目列表，默认 `limit=20`
- 删除项目必须二次确认
- 删除后刷新项目列表

### 4.2 NewProjectPage

API:

- `POST /projects`

表单:

- `name`: 必填，1-200 字符
- `original_idea`: 必填，1-10000 字符

交互:

- 提交成功后跳转 `/projects/[projectId]`
- 参数错误显示字段级错误
- 网络错误显示页面级错误与重试

### 4.3 ProjectOverviewPage

API:

- `GET /projects/{project_id}`
- `POST /projects/{project_id}/run`
- `GET /projects/{project_id}/workflow/status`

交互:

- 未启动时显示“启动工作流”
- 已运行时显示当前阶段与进度
- 已完成时显示产物入口
- 启动工作流成功后跳转 `/projects/[projectId]/workflow`

### 4.4 WorkflowPage

API:

- `GET /projects/{project_id}/workflow/status`
- `GET /projects/{project_id}/workflow/states`
- `POST /projects/{project_id}/workflow/continue`
- `POST /projects/{project_id}/conversations`
- `POST /projects/{project_id}/conversations/{conversation_id}/messages`
- `GET /projects/{project_id}/conversations/{conversation_id}/messages`

轮询:

- `active` 且非澄清阶段: 2-5 秒轮询 `workflow/status`
- `requirement_clarification`: 停止自动推进轮询，等待用户回复
- `completed/failed`: 停止轮询

澄清:

- 页面必须展示 `clarification_questions`
- 同一轮需求澄清必须复用 `workflow/status.conversation_id`
- 页面展示 conversation 消息历史，刷新后可以恢复
- Agent 每次仍认为信息不足时继续提问，最多 5 轮
- 用户提交回复后调用 `workflow/continue`
- 检查点讨论消息调用 `workflow/discuss`，确认推进调用 `workflow/advance`
- 同一回复提交按钮在请求期间禁用，防重复提交
- `waiting_for=review` 时展示“继续讨论”和“确认，继续下一环节”两个操作
- 需求确认、MVP 取舍和技术方案确认均复用同一对话面板；内部分析阶段不单独打断用户

降级显示:

- `model_status` 中任一模型 failed 时显示 warning，不阻断流程
- 工作流 failed 时展示 `error_message` 和相关执行历史入口

### 4.5 ArtifactsPage

API:

- `GET /projects/{project_id}/artifacts?type=`
- `POST /projects/{project_id}/export/prd`
- `GET /projects/{project_id}/export/{export_id}`

交互:

- 支持按产物类型过滤
- 列表不渲染完整 `content`
- 导出任务通过 `export/{export_id}` 轮询，完成后显示下载入口

### 4.6 ArtifactDetailPage

API:

- `GET /projects/{project_id}/artifacts/{artifact_id}`
- `GET /projects/{project_id}/artifacts/{artifact_id}/download`

交互:

- Markdown 内容以纯文本/安全 Markdown 渲染，不使用 `dangerouslySetInnerHTML`
- 下载失败显示错误提示与重试

### 4.7 UsagePage

API:

- `GET /usage/tokens?project_id=`
- `GET /projects/{project_id}/usage/logs`
- `GET /projects/{project_id}/usage/logs/{log_id}`

交互:

- 模型调用日志分页展示，默认 `limit=20`
- Prompt 和响应详情只在用户点击后加载
- 成本超过预算 80% 时显示 warning

## 5. 组件分层

```
apps/web/src/
├── app/
│   ├── page.tsx
│   └── projects/
├── components/
│   ├── layout/
│   ├── project/
│   ├── workflow/
│   ├── artifact/
│   └── usage/
├── features/
│   ├── projects/
│   ├── workflow/
│   ├── artifacts/
│   └── usage/
├── lib/
│   ├── api-client.ts
│   └── query-client.ts
└── types/
```

规则:

- `app/` 只放路由级页面和布局。
- API 调用集中在 `features/*/api.ts` 或 `lib/api-client.ts`。
- 展示组件不直接调用 API。
- API 类型从 OpenAPI 生成或从共享类型导入，不在组件内重复定义。

## 6. API Client 约束

统一封装:

```typescript
type ApiResult<T> = T;
type ApiError = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
};
```

要求:

- 所有请求带 `Authorization: Bearer <api_key>`，但 `/health` 和 `/models` 除外。
- `API_KEY` 来源第一版使用环境变量或本地开发配置，不提供用户登录 UI。
- 所有非 2xx 响应必须解析为 `ApiError`。
- 不在组件中拼接 URL，使用 API Client 方法。

## 7. 状态管理

| 状态             | 存放位置                             |
| ---------------- | ------------------------------------ |
| 表单输入         | 页面内 React state / React Hook Form |
| 请求状态         | TanStack Query                       |
| 项目列表/详情    | TanStack Query cache                 |
| 当前工作流状态   | TanStack Query polling               |
| UI 展开/筛选状态 | 页面内 state                         |

禁止:

- 将请求结果复制进全局 store。
- 为 MVP 引入额外全局状态库。
- 在多个组件重复维护同一派生状态。

## 8. Loading / Empty / Error

每个页面必须覆盖:

- loading: 骨架屏或局部加载状态
- empty: 明确的空态和下一步操作
- error: 显示错误信息、错误码、重试入口

敏感操作:

- 删除项目必须确认
- 导出重试不会重复创建多个不可见任务；重复点击期间禁用按钮

## 9. A11y

- 表单字段必须有 label。
- 可点击元素必须使用 `button` 或 `a`。
- 轮询状态变化使用可读文本，不只依赖颜色。
- 错误提示与对应字段通过 `aria-describedby` 关联。
- 键盘可完成创建项目、提交澄清、打开产物详情、下载产物。

## 10. 性能

- 项目列表、模型日志默认分页，不一次性渲染大数组。
- Markdown 详情页只在详情接口返回后渲染。
- 轮询仅在 WorkflowPage 激活时运行。
- 离开 WorkflowPage 后必须停止轮询。

## 11. 测试

单测:

- API Client 错误解析
- 表单校验
- Workflow 状态展示
- Artifact 列表过滤

集成测试:

- 创建项目成功/失败
- 启动工作流
- 澄清阶段提交回复
- 产物列表与详情加载

E2E:

- 创建项目 -> 启动工作流 -> 澄清回复 -> 完成后查看产物

## 12. 验收标准

- 用户可以通过 Web UI 创建项目。
- 用户可以启动工作流并查看阶段进度。
- 澄清阶段可以提交回复并继续工作流。
- 工作流完成后可以查看 11 类产物。
- 用户可以导出并下载产物。
- Token 用量和模型调用日志可查看。
- 所有页面具备 loading、empty、error 状态。
- `pnpm lint`、`pnpm build`、前端单测和关键 E2E 通过。
