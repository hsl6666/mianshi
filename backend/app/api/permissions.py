from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, require_permission
from app.core.security import CurrentUser
from app.db import get_db
from app.schemas import PermissionModuleOut, RoleCreate, RoleOut, RolePermissionsUpdate, RoleUpdate
from app.services import operation_logs as log_service
from app.services import permissions as permission_service
from app.services import roles as role_service

router = APIRouter(
    prefix="/api/permissions",
    tags=["permissions"],
    dependencies=[Depends(require_permission("menus", "permissions"))],
)


def _role_to_out(db: Session, role) -> RoleOut:
    return RoleOut(
        id=role.id,
        name=role.name,
        code=role.code,
        description=role.description,
        is_system=role.is_system,
        permissions=role_service.permissions_from_role(role),
        user_count=role_service.count_users_with_role(db, role.id),
    )


@router.get("/catalog", response_model=list[PermissionModuleOut])
def get_permission_catalog() -> list[PermissionModuleOut]:
    return permission_service.permission_catalog()


@router.get("/roles", response_model=list[RoleOut])
def list_roles(db: Session = Depends(get_db)) -> list[RoleOut]:
    rows = role_service.list_roles(db)
    return [_role_to_out(db, role) for role in rows]


@router.post("/roles", response_model=RoleOut, status_code=201)
def create_role(
    payload: RoleCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("menus", "permissions")),
) -> RoleOut:
    try:
        role = role_service.create_role(
            db,
            name=payload.name,
            description=payload.description,
            permissions=payload.permissions,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_service.record_log(
        db,
        username=admin.username,
        action="create",
        module="permissions",
        resource_type="role",
        resource_id=role.id,
        summary=f"创建角色 {role.name}",
        ip_address=get_client_ip(request),
    )
    return _role_to_out(db, role)


@router.put("/roles/{role_id}", response_model=RoleOut)
def update_role(
    role_id: int,
    payload: RoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("menus", "permissions")),
) -> RoleOut:
    role = role_service.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    try:
        role = role_service.update_role(db, role, name=payload.name, description=payload.description)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_service.record_log(
        db,
        username=admin.username,
        action="update",
        module="permissions",
        resource_type="role",
        resource_id=role.id,
        summary=f"更新角色 {role.name}",
        ip_address=get_client_ip(request),
    )
    return _role_to_out(db, role)


@router.put("/roles/{role_id}/permissions", response_model=RoleOut)
def update_role_permissions(
    role_id: int,
    payload: RolePermissionsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("menus", "permissions")),
) -> RoleOut:
    role = role_service.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    try:
        role_service.update_role_permissions(db, role, payload.permissions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_service.record_log(
        db,
        username=admin.username,
        action="update",
        module="permissions",
        resource_type="role",
        resource_id=role.id,
        summary=f"更新角色 {role.name} 的权限配置",
        ip_address=get_client_ip(request),
    )
    return _role_to_out(db, role)


@router.delete("/roles/{role_id}", status_code=204)
def delete_role(
    role_id: int,
    request: Request,
    db: Session = Depends(get_db),
    admin: CurrentUser = Depends(require_permission("menus", "permissions")),
) -> None:
    role = role_service.get_role_by_id(db, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="角色不存在")
    role_name = role.name
    try:
        role_service.delete_role(db, role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    log_service.record_log(
        db,
        username=admin.username,
        action="delete",
        module="permissions",
        resource_type="role",
        resource_id=role_id,
        summary=f"删除角色 {role_name}",
        ip_address=get_client_ip(request),
    )
