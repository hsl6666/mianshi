"""平台模块与操作权限定义。"""

from __future__ import annotations

from copy import deepcopy
from typing import Dict

# module -> { action -> label }
PERMISSION_CATALOG: Dict[str, Dict[str, str]] = {
    "menus": {
        "dashboard": "Dashboard",
        "recharge_console": "充值控制台",
        "bidding_projects": "项目管理",
        "users": "用户管理",
        "operation_logs": "操作日志",
        "permissions": "权限管理",
    },
    "bidding": {
        "view": "查看项目",
        "create": "创建/登记",
        "edit": "编辑",
        "delete": "删除",
        "feedback": "评审反馈",
        "preview": "预览",
        "download": "下载",
        "report_view": "查看报告",
        "report_upload": "上传报告",
        "report_json": "上传JSON",
        "report_page": "报告页",
        "report_download": "下载报告",
        "analysis": "分析",
        "sync": "标为已同步",
    },
    "users": {
        "view": "查看",
        "create": "创建",
        "edit": "编辑",
        "delete": "删除",
    },
    "operation_logs": {
        "view": "查看",
    },
}

MODULE_LABELS: Dict[str, str] = {
    "menus": "菜单管理",
    "bidding": "招投标项目",
    "users": "用户管理",
    "operation_logs": "操作日志",
}

DEFAULT_USER_PERMISSIONS: Dict[str, Dict[str, bool]] = {
    "menus": {
        "dashboard": True,
        "recharge_console": False,
        "bidding_projects": True,
        "users": False,
        "operation_logs": False,
        "permissions": False,
    },
    "bidding": {
        "view": True,
        "create": True,
        "edit": True,
        "delete": False,
        "feedback": True,
        "preview": True,
        "download": True,
        "report_view": True,
        "report_upload": True,
        "report_json": True,
        "report_page": True,
        "report_download": True,
        "analysis": False,
        "sync": False,
    },
    "users": {
        "view": False,
        "create": False,
        "edit": False,
        "delete": False,
    },
    "operation_logs": {
        "view": False,
    },
}

_MENUS_LEGACY_SOURCES: Dict[str, tuple[str, str]] = {
    "dashboard": ("bidding", "view"),
    "bidding_projects": ("bidding", "view"),
    "users": ("users", "view"),
    "operation_logs": ("operation_logs", "view"),
}

_BIDDING_VIEW_ALIASES = ("preview", "download")
_BIDDING_REPORT_ALIASES = (
    "report_view",
    "report_upload",
    "report_json",
    "report_page",
    "report_download",
)


def _expand_legacy_menu_permissions(
    menus: Dict[str, bool],
    raw: Dict[str, Dict[str, bool]],
) -> Dict[str, bool]:
    expanded = dict(menus)
    for menu_action, (module, action) in _MENUS_LEGACY_SOURCES.items():
        if menu_action not in expanded:
            module_perms = raw.get(module) or {}
            if action in module_perms:
                expanded[menu_action] = bool(module_perms[action])
    expanded.setdefault("permissions", False)
    return expanded


def _expand_legacy_bidding_permissions(bidding: Dict[str, bool]) -> Dict[str, bool]:
    expanded = dict(bidding)
    view_val = expanded.get("view")
    if view_val is not None:
        for key in _BIDDING_VIEW_ALIASES:
            expanded.setdefault(key, view_val)
    report_val = expanded.get("report")
    if report_val is not None:
        for key in _BIDDING_REPORT_ALIASES:
            expanded.setdefault(key, report_val)
    return expanded


def all_permissions_enabled() -> Dict[str, Dict[str, bool]]:
    return {
        module: {action: True for action in actions}
        for module, actions in PERMISSION_CATALOG.items()
    }


def normalize_permissions(raw: Dict[str, Dict[str, bool]] | None) -> Dict[str, Dict[str, bool]]:
    normalized = deepcopy(DEFAULT_USER_PERMISSIONS)
    if not raw:
        return normalized
    for module, actions in PERMISSION_CATALOG.items():
        incoming = raw.get(module) or {}
        if module == "bidding":
            incoming = _expand_legacy_bidding_permissions(incoming)
        if module == "menus":
            incoming = _expand_legacy_menu_permissions(incoming, raw)
        for action in actions:
            if action in incoming:
                normalized[module][action] = bool(incoming[action])
    return normalized


def has_permission(
    permissions: Dict[str, Dict[str, bool]] | None,
    module: str,
    action: str,
    *,
    is_super_admin: bool = False,
) -> bool:
    if is_super_admin:
        return True
    if module not in PERMISSION_CATALOG or action not in PERMISSION_CATALOG[module]:
        return False
    normalized = normalize_permissions(permissions)
    return bool(normalized.get(module, {}).get(action))
