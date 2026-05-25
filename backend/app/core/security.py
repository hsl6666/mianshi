from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.roles import is_super_admin
from app.models import UserRole

ALGORITHM = "HS256"


@dataclass
class TokenPayload:
    username: str
    role: UserRole


def create_token(username: str, role: UserRole, *, expires_hours: int) -> str:
    settings = get_settings()
    expire = datetime.now(timezone.utc) + timedelta(hours=expires_hours)
    payload = {"sub": username, "role": role.value, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def create_access_token(username: str, role: UserRole) -> str:
    settings = get_settings()
    return create_token(username, role, expires_hours=settings.jwt_access_expire_hours)


def create_refresh_token(username: str, role: UserRole) -> str:
    settings = get_settings()
    return create_token(username, role, expires_hours=settings.jwt_refresh_expire_hours)


def decode_token(token: str) -> TokenPayload:
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录已过期，请重新登录",
        ) from exc
    username = payload.get("sub")
    role_value = payload.get("role", UserRole.user.value)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的登录凭证")
    try:
        role = UserRole(role_value)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="无效的登录凭证") from exc
    return TokenPayload(username=str(username), role=role)


@dataclass
class CurrentUser:
    username: str
    role: UserRole

    @property
    def is_super_admin(self) -> bool:
        return is_super_admin(self.username, self.role.value)

    @property
    def owner_filter(self) -> str | None:
        """普通用户按 owner 过滤；超管返回 None 表示查看全部。"""
        return None if self.is_super_admin else self.username
