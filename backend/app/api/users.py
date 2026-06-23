from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, require_permission
from app.core.security import CurrentUser
from app.db import get_db
from app.models import User
from app.schemas import RoleListItem, UserCreate, UserOut, UserUpdate
from app.services import roles as role_service
from app.services import operation_logs as log_service
from app.services import users as user_service

router = APIRouter(prefix="/api/users", tags=["users"])


def _user_to_out(user) -> UserOut:
    return UserOut(
        id=user.id,
        username=user.username,
        role=user.role,
        role_id=user.role_id,
        role_name=user.role_ref.name if user.role_ref else None,
        is_active=user.is_active,
        display_name=user.display_name,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("/role-options", response_model=list[RoleListItem], dependencies=[Depends(require_permission("users", "view"))])
def list_role_options(db: Session = Depends(get_db)) -> list[RoleListItem]:
    return [
        RoleListItem(id=role.id, name=role.name, code=role.code, is_system=role.is_system)
        for role in role_service.list_roles(db)
    ]


@router.get("", response_model=list[UserOut], dependencies=[Depends(require_permission("users", "view"))])
def list_users(db: Session = Depends(get_db)) -> list[UserOut]:
    return [_user_to_out(u) for u in user_service.list_users(db)]


@router.post("", response_model=UserOut, status_code=201, dependencies=[Depends(require_permission("users", "create"))])
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("users", "create")),
) -> UserOut:
    try:
        user = user_service.create_user(
            db,
            username=payload.username,
            password=payload.password,
            role_id=payload.role_id,
            display_name=payload.display_name,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    role = role_service.get_role_by_id(db, user.role_id) if user.role_id else None
    log_service.record_log(
        db,
        username=admin.username,
        action="create",
        module="user",
        resource_type="user",
        resource_id=user.id,
        summary=f"创建用户 {user.username}",
        detail={"role_id": user.role_id, "role_name": role.name if role else None},
        ip_address=get_client_ip(request),
    )
    user = user_service.get_user_by_username(db, user.username) or user
    return _user_to_out(user)


@router.patch("/{user_id}", response_model=UserOut, dependencies=[Depends(require_permission("users", "edit"))])
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("users", "edit")),
) -> UserOut:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    try:
        user = user_service.update_user(
            db,
            user,
            password=payload.password,
            role_id=payload.role_id,
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
    return _user_to_out(user)


@router.delete("/{user_id}", status_code=204, dependencies=[Depends(require_permission("users", "delete"))])
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("users", "delete")),
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
