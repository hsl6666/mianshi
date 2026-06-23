from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Quanzhan API"
    environment: str = "development"
    database_url: str = "sqlite:///./data/app.db"
    frontend_origin: str = "http://127.0.0.1:5173"
    uploads_dir: Path = Path("./data/uploads")
    jwt_secret: str = "quanzhan-dev-jwt-secret-change-in-production"
    jwt_access_expire_hours: int = 12
    jwt_refresh_expire_hours: int = 168
    feishu_bid_notify_webhook_url: str | None = None
    feishu_bid_notify_secret: str | None = None
    feishu_bid_notify_at_user_id: str | None = None
    feishu_bid_notify_timeout_seconds: float = 5.0
    report_data_upload_api_key: str = "qz-report-data-upload-2026-06-04"
    third_party_api_base_url: str = "http://101.42.182.149"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings
