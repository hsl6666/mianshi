from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.core.security import create_access_token, create_refresh_token
from app.db import get_db
from app.schemas import CurrentUserOut, LoginRequest, TokenResponse
from app.services import operation_logs as log_service
from app.services import users as user_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)) -> TokenResponse:
    user = user_service.authenticate(db, payload.username, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="用户名或密码错误")
    log_service.record_log(
        db,
        username=user.username,
        action="login",
        module="auth",
        summary=f"用户 {user.username} 登录系统",
        ip_address=get_client_ip(request),
    )
    return TokenResponse(
        access_token=create_access_token(user.username, user.role),
        refresh_token=create_refresh_token(user.username, user.role),
        username=user.username,
        role=user.role,
        display_name=user.display_name,
    )


@router.get("/me", response_model=CurrentUserOut)
def get_me(current_user=Depends(get_current_user), db: Session = Depends(get_db)) -> CurrentUserOut:
    user = user_service.get_user_by_username(db, current_user.username)
    display_name = user.display_name if user else None
    return CurrentUserOut(
        username=current_user.username,
        role=current_user.role,
        display_name=display_name,
        is_super_admin=current_user.is_super_admin,
    )
