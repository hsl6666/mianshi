from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, require_super_admin
from app.core.security import CurrentUser
from app.db import get_db
from app.models import User
from app.schemas import UserCreate, UserOut, UserUpdate
from app.services import operation_logs as log_service
from app.services import users as user_service

router = APIRouter(prefix="/api/users", tags=["users"], dependencies=[Depends(require_super_admin)])


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    return [UserOut.model_validate(u) for u in user_service.list_users(db)]


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_super_admin),
) -> UserOut:
    try:
        user = user_service.create_user(
            db,
            username=payload.username,
            password=payload.password,
            role=payload.role,
            display_name=payload.display_name,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_service.record_log(
        db,
        username=admin.username,
        action="create",
        module="user",
        resource_type="user",
        resource_id=user.id,
        summary=f"创建用户 {user.username}",
        detail={"role": user.role.value},
        ip_address=get_client_ip(request),
    )
    return UserOut.model_validate(user)


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_super_admin),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    try:
        user = user_service.update_user(
            db,
            user,
            password=payload.password,
            role=payload.role,
            display_name=payload.display_name,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_service.record_log(
        db,
        username=admin.username,
        action="update",
        module="user",
        resource_type="user",
        resource_id=user.id,
        summary=f"更新用户 {user.username}",
        ip_address=get_client_ip(request),
    )
    return UserOut.model_validate(user)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_super_admin),
) -> None:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    username = user.username
    try:
        user_service.delete_user(db, user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_service.record_log(
        db,
        username=admin.username,
        action="delete",
        module="user",
        resource_type="user",
        resource_id=user_id,
        summary=f"删除用户 {username}",
        ip_address=get_client_ip(request),
    )
