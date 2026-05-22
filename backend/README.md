# 全栈后端基础框架

FastAPI + SQLAlchemy 脚手架，仅包含健康检查与数据库初始化。

## 本地启动

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

健康检查：`GET /health`
