from __future__ import annotations

import json

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import DEFAULT_USER_PERMISSIONS, all_permissions_enabled, normalize_permissions
from app.models import Role, User

SUPER_ADMIN_ROLE_CODE = "super_admin"
DEFAULT_USER_ROLE_CODE = "default_user"


def serialize_permissions(permissions: dict[str, dict[str, bool]]) -> str:
    return json.dumps(permissions, ensure_ascii=False)


def permissions_from_role(role: Role | None) -> dict[str, dict[str, bool]]:
    if role is None or not role.permissions_json:
        return normalize_permissions(None)
    try:
        raw = json.loads(role.permissions_json)
    except json.JSONDecodeError:
        return normalize_permissions(None)
    if not isinstance(raw, dict):
        return normalize_permissions(None)
    return normalize_permissions(raw)


def list_roles(db: Session) -> list[Role]:
    return db.scalars(select(Role).order_by(Role.is_system.desc(), Role.id.asc())).all()


def get_role_by_id(db: Session, role_id: int) -> Role | None:
    return db.scalar(select(Role).where(Role.id == role_id))


def get_role_by_code(db: Session, code: str) -> Role | None:
    return db.scalar(select(Role).where(Role.code == code))


def count_users_with_role(db: Session, role_id: int) -> int:
    return db.scalar(select(func.count(User.id)).where(User.role_id == role_id)) or 0


def create_role(
    db: Session,
    *,
    name: str,
    description: str | None = None,
    permissions: dict[str, dict[str, bool]] | None = None,
) -> Role:
    name = name.strip()
    if not name:
        raise ValueError("角色名称不能为空")
    existing = db.scalar(select(Role).where(Role.name == name))
    if existing:
        raise ValueError("角色名称已存在")
    code = _generate_unique_code(db, name)
    normalized = normalize_permissions(permissions or DEFAULT_USER_PERMISSIONS)
    role = Role(
        name=name,
        code=code,
        description=description,
        is_system=False,
        permissions_json=serialize_permissions(normalized),
    )
    db.add(role)
    db.commit()
    db.refresh(role)
    return role


def update_role(
    db: Session,
    role: Role,
    *,
    name: str | None = None,
    description: str | None = None,
) -> Role:
    if name is not None:
        name = name.strip()
        if not name:
            raise ValueError("角色名称不能为空")
        existing = db.scalar(select(Role).where(Role.name == name, Role.id != role.id))
        if existing:
            raise ValueError("角色名称已存在")
        role.name = name
    if description is not None:
        role.description = description
    db.commit()
    db.refresh(role)
    return role


def update_role_permissions(
    db: Session,
    role: Role,
    permissions: dict[str, dict[str, bool]],
) -> dict[str, dict[str, bool]]:
    if role.code == SUPER_ADMIN_ROLE_CODE:
        raise ValueError("不能修改超级管理员角色的权限")
    normalized = normalize_permissions(permissions)
    role.permissions_json = serialize_permissions(normalized)
    db.commit()
    db.refresh(role)
    return normalized


def delete_role(db: Session, role: Role) -> None:
    if role.is_system:
        raise ValueError("不能删除系统内置角色")
    if count_users_with_role(db, role.id) > 0:
        raise ValueError("该角色下仍有用户，无法删除")
    db.delete(role)
    db.commit()


def seed_system_roles(db: Session) -> None:
    super_admin = get_role_by_code(db, SUPER_ADMIN_ROLE_CODE)
    if not super_admin:
        super_admin = Role(
            name="超级管理员",
            code=SUPER_ADMIN_ROLE_CODE,
            description="系统内置，拥有全部权限",
            is_system=True,
            permissions_json=serialize_permissions(all_permissions_enabled()),
        )
        db.add(super_admin)

    default_user = get_role_by_code(db, DEFAULT_USER_ROLE_CODE)
    if not default_user:
        default_user = Role(
            name="普通用户",
            code=DEFAULT_USER_ROLE_CODE,
            description="系统内置默认角色",
            is_system=True,
            permissions_json=serialize_permissions(DEFAULT_USER_PERMISSIONS),
        )
        db.add(default_user)

    db.commit()


def sync_user_role_enum(role: Role) -> str:
    from app.models import UserRole

    if role.code == SUPER_ADMIN_ROLE_CODE:
        return UserRole.super_admin.value
    return UserRole.user.value


def _name_to_code(name: str) -> str:
    return name.strip().lower().replace(" ", "_")


def _generate_unique_code(db: Session, name: str) -> str:
    base = _name_to_code(name)
    if not base:
        base = "role"
    code = base
    index = 1
    while get_role_by_code(db, code):
        code = f"{base}_{index}"
        index += 1
    return code
