from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Quanzhan API"
    environment: str = "development"
    database_url: str = "sqlite:///./data/app.db"
    frontend_origin: str = "http://127.0.0.1:5173"
    uploads_dir: Path = Path("./data/uploads")

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings
