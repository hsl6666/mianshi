# 招投标咨询项目管理系统

面向招投标咨询公司的项目台账：记录协助编写的投标文件，分两步管理——**项目登记**与**评审反馈**。

技术栈：React + TypeScript + Ant Design + Tailwind 前端，FastAPI + SQLAlchemy + SQLite 后端。

## 业务流程

| 步骤 | 说明 | 字段/操作 |
|------|------|-----------|
| **项目组** | 按开标时间维度建组 | 分组名称（如「5月27号开标」）、开标时间、招标文件、投标文件（组内共享） |
| **第一步** | 在组下登记项目 | 项目名称、参加单位、开标时间 |
| **第二步** | 评审反馈 | 开标后填写最终得分、排名、打分明细、备注 |

项目状态自动流转：

- **已登记**：已创建，开标时间未到
- **待反馈**：开标时间已到，等待录入评审结果
- **已完成**：已提交评审反馈

## 功能说明

### 登录与鉴权

- JWT 登录，未登录自动跳转登录页
- 内置账号：`cqzsxh` / `zcs`，密码均为 `123456`
- 各账号招投标数据按 `owner` 隔离，仅能看到自己创建的项目组与项目；历史数据归属 `cqzsxh`

### 角色与菜单权限

| 角色 | 账号示例 | 可见模块 |
|------|----------|----------|
| 超级管理员 | `cqzsxh` | 项目管理、用户管理、操作日志 |
| 普通用户 | `zcs` 等 | 仅项目管理 |

### 用户管理（超级管理员）

- 用户列表、新建、编辑、禁用、改密、删除
- `cqzsxh` 为系统保留超级管理员，不可删除或禁用

### 操作日志（超级管理员）

- 分页查看登录、用户、招投标等操作记录
- 支持按关键词、操作人、模块筛选

### 项目管理

- 树形列表：项目组为父级，项目为子级
- 新建项目组：仅填分组名称；在组内「添加项目」需填写项目信息并上传招标/投标文件
- 编辑项目组：仅可改分组名称；编辑项目：可改名称、参加单位、开标时间
- 评审反馈、附件下载、项目删除

## 目录结构

```text
backend/
  app/api/auth.py               登录鉴权
  app/api/users.py              用户管理（超管）
  app/api/operation_logs.py     操作日志（超管）
  app/api/bidding_projects.py   招投标项目 REST API
  app/models.py                 数据模型（User、OperationLog 等）
  app/schemas.py                Pydantic 校验
  app/services/                 业务逻辑与文件存储
frontend/
  src/features/bidding/         项目管理页面与组件
  src/pages/Login/              登录页
  src/pages/UserManagement/     用户管理（超管）
  src/pages/OperationLogs/      操作日志（超管）
  src/request/client.ts         API 客户端（Token 注入）
```

## 登录

- 登录页：http://127.0.0.1:5173/login
- 登录接口：`POST /api/auth/login`（JSON：`username`、`password`）
- 当前用户：`GET /api/auth/me`
- 业务接口需在请求头携带：`Authorization: Bearer <access_token>`

## API 概览

**认证**

- `POST /api/auth/login` — 登录获取 Token（含 `role`）
- `GET /api/auth/me` — 当前用户信息

**用户与日志（超级管理员）**

- `GET/POST/PATCH/DELETE /api/users` — 用户 CRUD
- `GET /api/operation-logs` — 操作日志分页列表

**招投标**

- `GET /api/bidding-project-groups` — 项目组列表
- `POST /api/bidding-project-groups` — 新建项目组
- `PATCH /api/bidding-project-groups/{id}` — 更新项目组名称
- `GET /api/bidding-projects` — 分页树形列表（keyword、status）
- `POST /api/bidding-projects` — 新建项目（`group_id` 或 `group_name`）
- `GET/PATCH/DELETE /api/bidding-projects/{id}` — 项目详情/更新/删除
- `POST /api/bidding-projects/{id}/feedback` — 提交评审反馈
- `GET /api/bidding-project-groups/{gid}/attachments/{aid}/download` — 下载组附件

## 启动

```bash
# 后端
cd backend
cp .env.example .env
pip install -r requirements.txt
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload

# 前端
cd frontend
npm install
npm run dev
```

- 前端：http://127.0.0.1:5173/login
- 后端健康检查：http://127.0.0.1:8010/health

开发模式下 Vite 会将 `/api` 代理到 `8010`。

## 分支

- `项目基础框架`：脚手架
- `feature/招投标项目管理`：招投标业务、登录鉴权、用户管理与操作日志
