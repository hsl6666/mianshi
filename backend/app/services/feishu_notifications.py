from __future__ import annotations

import base64
from dataclasses import dataclass
from datetime import datetime
import hashlib
import hmac
from html import escape
import logging
import time
from typing import Callable

import httpx

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class BidUploadNotification:
    group_name: str
    project_name: str
    company_name: str
    original_name: str
    version_number: int
    size_bytes: int
    uploaded_by: str
    uploaded_at: datetime


def generate_feishu_sign(timestamp: str | int, secret: str) -> str:
    string_to_sign = f"{timestamp}\n{secret}"
    digest = hmac.new(string_to_sign.encode("utf-8"), digestmod=hashlib.sha256).digest()
    return base64.b64encode(digest).decode("utf-8")


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _format_file_size(size_bytes: int) -> str:
    if size_bytes < 1024:
        return f"{size_bytes} B"
    if size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    return f"{size_bytes / 1024 / 1024:.1f} MB"


def _build_text(notification: BidUploadNotification, at_user_id: str | None) -> str:
    mention = ""
    if at_user_id:
        mention = f'<at user_id="{escape(at_user_id, quote=True)}">你</at>\n'

    lines = [
        f"{mention}投标文件已上传",
        f"项目组：{escape(notification.group_name)}",
        f"项目：{escape(notification.project_name)}",
        f"投标单位：{escape(notification.company_name)}",
        f"文件：{escape(notification.original_name)}",
        f"版本：v{notification.version_number}",
        f"大小：{_format_file_size(notification.size_bytes)}",
        f"上传人：{escape(notification.uploaded_by)}",
        f"上传时间：{notification.uploaded_at:%Y-%m-%d %H:%M:%S}",
    ]
    return "\n".join(lines)


def build_feishu_payload(notification: BidUploadNotification, *, timestamp: str | None = None) -> dict:
    settings = get_settings()
    at_user_id = _clean(settings.feishu_bid_notify_at_user_id)
    payload = {
        "msg_type": "text",
        "content": {
            "text": _build_text(notification, at_user_id),
        },
    }

    secret = _clean(settings.feishu_bid_notify_secret)
    if secret:
        resolved_timestamp = timestamp or str(int(time.time()))
        payload["timestamp"] = resolved_timestamp
        payload["sign"] = generate_feishu_sign(resolved_timestamp, secret)

    return payload


async def notify_bid_upload(
    notification: BidUploadNotification,
    *,
    now: Callable[[], int] | None = None,
    transport: httpx.AsyncBaseTransport | None = None,
) -> bool:
    settings = get_settings()
    webhook_url = _clean(settings.feishu_bid_notify_webhook_url)
    if not webhook_url:
        return False

    timestamp = str((now or (lambda: int(time.time())))())
    payload = build_feishu_payload(notification, timestamp=timestamp)

    try:
        async with httpx.AsyncClient(
            timeout=settings.feishu_bid_notify_timeout_seconds,
            transport=transport,
        ) as client:
            response = await client.post(webhook_url, json=payload)
        response.raise_for_status()
        result = response.json()
    except Exception:
        logger.exception("Failed to send Feishu bid upload notification")
        return False

    code = result.get("code", result.get("StatusCode", 0)) if isinstance(result, dict) else 0
    if code not in (0, "0", None):
        logger.warning("Feishu bid upload notification returned non-zero code: %s", result)
        return False

    return True
