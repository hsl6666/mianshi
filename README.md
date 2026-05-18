# AI 面试官流程系统

这是按需求落地的可运行 MVP：React + TypeScript + Tailwind + Antd 前端，FastAPI + SQLite 后端，包含真实扫码上传、简历解析回填、岗位笔试、Monaco 代码题、WebRTC 信令、LangGraph/GLM-4.6 占位、口试字幕、摄像头随机抽帧入库。

## 目录结构

```text
backend/
  app/api/              REST、移动上传页、WebRTC 信令
  app/core/             配置与环境变量
  app/services/         简历解析、题库、LangGraph 面试编排、RTC
  app/models.py         SQLite 数据模型
  app/schemas.py        Pydantic API schema
frontend/
  src/features/interview/
    api.ts              面试流程专用 API 客户端
    storage.ts          session/localStorage
    components/         流程壳、表单控件、歌词字幕
    pages/              Step1/Step2/Step3/完成页
docker-compose.yml
```

## 核心数据模型

- `sessions`：候选人 session、岗位、表单资料、解析资料、简历文本、笔试提交、口试摘要。
- `attachments`：上传附件元数据、文件路径、解析文本。
- `transcripts`：口试用户转写与 AI 回复。
- `interview_snapshots`：摄像头随机抽帧，图片二进制保存在 SQLite，文件目录只做缓存备份。

## API 设计

- `POST /api/sessions` 创建或确认 session
- `GET /api/sessions/{id}` 获取候选人 session、附件、解析结果、抽帧
- `PATCH /api/sessions/{id}` 保存基础表单
- `GET /m/upload?sessionId=...` 手机上传页
- `POST /api/sessions/{id}/attachments` 上传 PDF/图片并触发解析
- `GET /api/questions?role=...` 按岗位获取题目
- `POST /api/sessions/{id}/written-submission` 保存笔试
- `POST /api/rtc/offer` WebRTC SDP 信令
- `POST /api/sessions/{id}/oral/start` 开场提问
- `POST /api/sessions/{id}/oral/respond` 保存候选回答并生成追问
- `POST /api/sessions/{id}/snapshots` 保存摄像头抽帧到数据库
- `GET /api/sessions/{id}/snapshots/{snapshotId}/image` 从数据库读取抽帧图片
- `POST /api/sessions/{id}/oral-summary` 保存口试 QA

## 启动

本地两条命令：

```bash
cd backend
cp .env.example .env
./.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

```bash
cd frontend
npm run dev
```

Docker：

```bash
docker compose up --build
```

当前机器已有其他服务占用 8000，本地开发默认使用后端 `8010`。手机扫码上传时，把 `backend/.env` 和 `frontend/.env.development` 的 `PUBLIC_BASE_URL` / `VITE_PUBLIC_BASE_URL` 改成电脑局域网 IP，例如：

```bash
ipconfig getifaddr en0
```

前端访问：`http://127.0.0.1:5173/interview/basic`。如果你按我当前联调方式启动，则访问 `http://127.0.0.1:5174/interview/basic`。
