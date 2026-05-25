from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import UploadFile

from app.core.config import get_settings

ALLOWED_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".zip", ".rar", ".7z"}
MAX_FILE_SIZE = 50 * 1024 * 1024


def ensure_upload_dir() -> Path:
    settings = get_settings()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    return settings.uploads_dir


def validate_upload(file: UploadFile) -> None:
    suffix = Path(file.filename or "").suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise ValueError(f"不支持的文件类型: {suffix or '未知'}")


async def save_upload(file: UploadFile, group_id: int) -> tuple[str, str, int, str | None]:
    validate_upload(file)
    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("文件大小不能超过 50MB")

    suffix = Path(file.filename or "file").suffix.lower()
    stored_name = f"group_{group_id}_{uuid.uuid4().hex}{suffix}"
    target = ensure_upload_dir() / stored_name
    target.write_bytes(content)
    return stored_name, file.filename or stored_name, len(content), file.content_type
