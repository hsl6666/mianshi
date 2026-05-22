# 全栈项目基础框架

React + TypeScript + Tailwind + Ant Design 前端脚手架，FastAPI + SQLAlchemy 后端脚手架。已移除面试/管理等业务模块，仅保留依赖、主题切换、布局与示例页面。

## 目录结构

```text
backend/
  app/api/          健康检查等基础 API
  app/core/         配置与环境变量
  app/db.py         SQLAlchemy 连接与初始化
frontend/
  src/components/   主题、Antd 配置、错误边界等
  src/layouts/      主布局 / 空白布局
  src/pages/        首页、Echarts 示例、404
  src/store/        Zustand 全局状态（侧栏折叠等）
docker-compose.yml
```

## 启动

本地开发：

```bash
cd backend
cp .env.example .env
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

```bash
cd frontend
npm install
npm run dev
```

Docker：

```bash
docker compose up --build
```

- 前端默认：`http://127.0.0.1:5173`
- 后端健康检查：`http://127.0.0.1:8010/health`

## 分支说明

当前分支 `项目基础框架` 从业务分支剥离，可作为新业务的起始模板。
