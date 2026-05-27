from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import auth, bidding_companies, bidding_project_groups, bidding_projects, health, operation_logs, users
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

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(operation_logs.router)
app.include_router(bidding_project_groups.router)
app.include_router(bidding_projects.router)
app.include_router(bidding_companies.router)


@app.on_event("startup")
def on_startup() -> None:
    init_db()
