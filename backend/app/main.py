from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import model_config, positions, questions, results, rtc, sessions
from app.core.config import get_settings
from app.db import init_db


settings = get_settings()
app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")
app.mount("/snapshots", StaticFiles(directory=settings.snapshots_dir), name="snapshots")

app.include_router(sessions.router)
app.include_router(questions.router)
app.include_router(positions.router)
app.include_router(model_config.router)
app.include_router(rtc.router)
app.include_router(results.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
