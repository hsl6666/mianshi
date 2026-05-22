# 招投标咨询项目管理系统

面向招投标咨询公司的项目台账：记录协助编写的投标文件，分两步管理——**项目登记**与**评审反馈**。

技术栈：React + TypeScript + Ant Design + Tailwind 前端，FastAPI + SQLAlchemy + SQLite 后端。

## 业务流程

| 步骤 | 说明 | 字段/操作 |
|------|------|-----------|
| **第一步** | 登记项目 | 项目名称、参加单位、招标文件、投标文件、开标时间 |
| **第二步** | 评审反馈 | 开标后填写最终得分、排名、打分明细、备注 |

项目状态自动流转：

- **已登记**：已创建，开标时间未到
- **待反馈**：开标时间已到，等待录入评审结果
- **已完成**：已提交评审反馈

## 目录结构

```text
backend/
  app/api/bidding_projects.py   招投标项目 REST API
  app/models.py                 数据模型
  app/schemas.py                Pydantic 校验
  app/services/                 业务逻辑与文件存储
frontend/
  src/features/bidding/         项目管理页面与组件
  src/request/client.ts         API 客户端
```

## API 概览

- `GET /api/bidding-projects` — 分页列表（支持 keyword、status）
- `POST /api/bidding-projects` — 新建项目（multipart 含文件）
- `GET /api/bidding-projects/{id}` — 项目详情
- `PATCH /api/bidding-projects/{id}` — 更新项目
- `POST /api/bidding-projects/{id}/feedback` — 提交/更新评审反馈
- `GET /api/bidding-projects/{id}/attachments/{aid}/download` — 下载附件
- `DELETE /api/bidding-projects/{id}` — 删除项目

## 启动

```bash
# 后端
cd backend
cp .env.example .env
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload

# 前端
cd frontend
npm install
npm run dev
```

- 前端：http://127.0.0.1:5173/bidding-projects
- 后端健康检查：http://127.0.0.1:8010/health

开发模式下 Vite 会将 `/api` 代理到 `8010`。

## 分支

- `项目基础框架`：脚手架
- `feature/招投标项目管理`：招投标业务功能
