from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.permissions import (
    PERMISSION_CATALOG,
    MODULE_LABELS,
    all_permissions_enabled,
    has_permission,
    normalize_permissions,
)
from app.core.roles import is_super_admin
from app.models import User, UserRole
from app.services.roles import permissions_from_role


def permissions_from_user(user: User | None) -> dict[str, dict[str, bool]]:
    if user is None:
        return normalize_permissions(None)
    if is_super_admin(user.username, user.role.value):
        return all_permissions_enabled()
    return permissions_from_role(user.role_ref)


def get_user_permissions(db: Session, user: User) -> dict[str, dict[str, bool]]:
    if user.role_ref is None and user.role_id:
        user = db.scalar(select(User).options(joinedload(User.role_ref)).where(User.id == user.id)) or user
    return permissions_from_user(user)


def user_has_permission(db: Session, username: str, role: UserRole, module: str, action: str) -> bool:
    if is_super_admin(username, role.value):
        return True
    user = db.scalar(select(User).options(joinedload(User.role_ref)).where(User.username == username))
    perms = permissions_from_user(user)
    return has_permission(perms, module, action)


def permission_catalog() -> list[dict]:
    items = []
    for module, actions in PERMISSION_CATALOG.items():
        items.append(
            {
                "module": module,
                "label": MODULE_LABELS.get(module, module),
                "actions": [
                    {"action": action, "label": label}
                    for action, label in actions.items()
                ],
            }
        )
    return items
