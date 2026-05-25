from __future__ import annotations

SUPER_ADMIN_USERNAME = "cqzsxh"


def is_super_admin(username: str, role: str) -> bool:
    return role == "super_admin" or username == SUPER_ADMIN_USERNAME
