# 招投标咨询后端 API

FastAPI + SQLAlchemy，SQLite 存储项目与附件元数据，文件保存在 `data/uploads/`。

## 启动

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8010 --reload
```

接口文档：http://127.0.0.1:8010/docs
