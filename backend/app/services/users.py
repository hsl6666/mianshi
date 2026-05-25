from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.password import hash_password, verify_password
from app.core.roles import SUPER_ADMIN_USERNAME, is_super_admin
from app.models import User, UserRole


def get_user_by_username(db: Session, username: str) -> User | None:
    return db.scalar(select(User).where(User.username == username))


def authenticate(db: Session, username: str, password: str) -> User | None:
    user = get_user_by_username(db, username)
    if not user or not user.is_active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def list_users(db: Session) -> list[User]:
    return db.scalars(select(User).order_by(User.id.asc())).all()


def create_user(
    db: Session,
    *,
    username: str,
    password: str,
    role: UserRole = UserRole.user,
    display_name: str | None = None,
    is_active: bool = True,
) -> User:
    if get_user_by_username(db, username):
        raise ValueError("用户名已存在")
    if username == SUPER_ADMIN_USERNAME and role != UserRole.super_admin:
        raise ValueError("该用户名为系统保留的超级管理员账号")
    user = User(
        username=username.strip(),
        password_hash=hash_password(password),
        role=role,
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
    role: UserRole | None = None,
    display_name: str | None = None,
    is_active: bool | None = None,
) -> User:
    if user.username == SUPER_ADMIN_USERNAME:
        if role is not None and role != UserRole.super_admin:
            raise ValueError("不能修改超级管理员的角色")
        if is_active is False:
            raise ValueError("不能禁用超级管理员账号")
    if password:
        user.password_hash = hash_password(password)
    if role is not None:
        user.role = role
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
    create_user(
        db,
        username=SUPER_ADMIN_USERNAME,
        password="123456",
        role=UserRole.super_admin,
        display_name="超级管理员",
    )
    create_user(db, username="zcs", password="123456", role=UserRole.user, display_name="zcs")
