from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.core.password import hash_password, verify_password
from app.core.roles import SUPER_ADMIN_USERNAME, is_super_admin
from app.models import User, UserRole
from app.services.roles import DEFAULT_USER_ROLE_CODE, SUPER_ADMIN_ROLE_CODE, get_role_by_code, get_role_by_id


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(
        select(User).options(joinedload(User.role_ref)).where(User.username == username),
    )


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_users(db: Session) -> list[User]:
    return db.scalars(
        select(User).options(joinedload(User.role_ref)).order_by(User.id.asc()),
    ).all()


def _resolve_role(db: Session, role_id: int):
    role = get_role_by_id(db, role_id)
    if not role:
        raise ValueError("角色不存在")
    return role


def _user_role_from_role_code(role_code: str) -> UserRole:
    if role_code == SUPER_ADMIN_ROLE_CODE:
        return UserRole.super_admin
    return UserRole.user


def create_user(
    db: Session,
    *,
    username: str,
    password: str,
    role_id: int,
    display_name: str | None = None,
    is_active: bool = True,
) -> User:
    if get_user_by_username(db, username):
        raise ValueError("用户名已存在")
    role = _resolve_role(db, role_id)
    if username == SUPER_ADMIN_USERNAME and role.code != SUPER_ADMIN_ROLE_CODE:
        raise ValueError("该用户名为系统保留的超级管理员账号")
    user_role = _user_role_from_role_code(role.code)
    user = User(
        username=username.strip(),
        password_hash=hash_password(password),
        role=user_role,
        role_id=role.id,
        display_name=display_name,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update_user(
    db: Session,
    user: User,
    *,
    password: str | None = None,
    role_id: int | None = None,
    display_name: str | None = None,
    is_active: bool | None = None,
) -> User:
    if user.username == SUPER_ADMIN_USERNAME:
        if role_id is not None:
            role = _resolve_role(db, role_id)
            if role.code != SUPER_ADMIN_ROLE_CODE:
                raise ValueError("不能修改超级管理员的角色")
        if is_active is False:
            raise ValueError("不能禁用超级管理员账号")
    if password:
        user.password_hash = hash_password(password)
    if role_id is not None:
        role = _resolve_role(db, role_id)
        user.role_id = role.id
        user.role = _user_role_from_role_code(role.code)
    if display_name is not None:
        user.display_name = display_name
    if is_active is not None:
        user.is_active = is_active
    db.commit()
    db.refresh(user)
    return user


def delete_user(db: Session, user: User) -> None:
    if user.username == SUPER_ADMIN_USERNAME:
        raise ValueError("不能删除超级管理员账号")
    db.delete(user)
    db.commit()


def seed_default_users(db: Session) -> None:
    existing = db.scalar(select(func.count(User.id))) or 0
    if existing > 0:
        return
    super_admin_role = get_role_by_code(db, SUPER_ADMIN_ROLE_CODE)
    default_role = get_role_by_code(db, DEFAULT_USER_ROLE_CODE)
    if not super_admin_role or not default_role:
        raise RuntimeError("系统角色未初始化，请先执行角色迁移")

    create_user(
        db,
        username=SUPER_ADMIN_USERNAME,
        password="123456",
        role_id=super_admin_role.id,
        display_name="超级管理员",
    )
    create_user(db, username="zcs", password="123456", role_id=default_role.id, display_name="zcs")
