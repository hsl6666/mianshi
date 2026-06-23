from __future__ import annotations

import hmac
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import MODULE_LABELS, PERMISSION_CATALOG
from app.core.security import CurrentUser, decode_token
from app.db import get_db
from app.services.permissions import user_has_permission

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> CurrentUser:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="未登录或登录已过期",
        )
    payload = decode_token(credentials.credentials)
    return CurrentUser(username=payload.username, role=payload.role)


def require_super_admin(current_user: CurrentUser = Depends(get_current_user)) -> CurrentUser:
    if not current_user.is_super_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="需要超级管理员权限")
    return current_user


def require_permission(module: str, action: str):
    module_label = MODULE_LABELS.get(module, module)
    action_label = PERMISSION_CATALOG.get(module, {}).get(action, action)

    def checker(
        current_user: CurrentUser = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> CurrentUser:
        if user_has_permission(db, current_user.username, current_user.role, module, action):
            return current_user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"缺少权限：{module_label}-{action_label}",
        )

    return checker


def require_report_data_upload_key(
    x_report_api_key: str | None = Header(default=None, alias="X-Report-Api-Key"),
) -> str:
    expected_key = get_settings().report_data_upload_api_key
    if not x_report_api_key or not hmac.compare_digest(x_report_api_key, expected_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="报告上传密钥无效")
    return "report_api"


def require_report_data_upload_auth(
    x_report_api_key: str | None = Header(default=None, alias="X-Report-Api-Key"),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> str:
    expected_key = get_settings().report_data_upload_api_key
    if x_report_api_key and hmac.compare_digest(x_report_api_key, expected_key):
        return "report_api"

    if credentials is not None and credentials.scheme.lower() == "bearer":
        payload = decode_token(credentials.credentials)
        current_user = CurrentUser(username=payload.username, role=payload.role)
        from app.db import SessionLocal

        with SessionLocal() as db:
            if user_has_permission(db, current_user.username, current_user.role, "bidding", "report_json"):
                return current_user.username
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="缺少报告管理权限",
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="报告上传密钥无效",
    )


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None
