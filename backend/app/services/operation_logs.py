from __future__ import annotations

import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.timezone import china_now
from app.models import OperationLog


def record_log(
    db: Session,
    *,
    username: str,
    action: str,
    module: str,
    summary: str,
    resource_type: str | None = None,
    resource_id: int | None = None,
    detail: dict[str, Any] | str | None = None,
    ip_address: str | None = None,
) -> OperationLog:
    detail_text = None
    if detail is not None:
        detail_text = detail if isinstance(detail, str) else json.dumps(detail, ensure_ascii=False)
    log = OperationLog(
        username=username,
        action=action,
        module=module,
        resource_type=resource_type,
        resource_id=resource_id,
        summary=summary,
        detail=detail_text,
        ip_address=ip_address,
        created_at=china_now(),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def list_logs(
    db: Session,
    page: int,
    page_size: int,
    keyword: str | None = None,
    module: str | None = None,
    username: str | None = None,
) -> tuple[list[OperationLog], int]:
    filters = []
    if keyword:
        like = f"%{keyword.strip()}%"
        filters.append(
            (OperationLog.summary.ilike(like))
            | (OperationLog.username.ilike(like))
            | (OperationLog.action.ilike(like))
        )
    if module:
        filters.append(OperationLog.module == module)
    if username:
        filters.append(OperationLog.username == username)

    count_stmt = select(func.count(OperationLog.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = db.scalar(count_stmt) or 0

    query = select(OperationLog)
    if filters:
        query = query.where(*filters)
    rows = db.scalars(
        query.order_by(OperationLog.created_at.desc(), OperationLog.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return rows, total
