# AI 面试官后端

## 本地启动

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

手机扫码上传需要把 `.env` 里的 `PUBLIC_BASE_URL` 改成当前电脑的局域网地址，例如：

```bash
ipconfig getifaddr en0
```

得到 `192.168.1.10` 后写入：

```env
PUBLIC_BASE_URL=http://192.168.1.10:8000
```
