from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.db import get_db
from app.schemas import OperationLogOut, PaginatedOperationLogs
from app.services import operation_logs as log_service

router = APIRouter(
    prefix="/api/operation-logs",
    tags=["operation-logs"],
    dependencies=[Depends(require_permission("operation_logs", "view"))],
)


@router.get("", response_model=PaginatedOperationLogs)
def list_operation_logs(
    page: int = 1,
    page_size: int = 20,
    keyword: Optional[str] = None,
    module: Optional[str] = None,
    username: Optional[str] = None,
    db: Session = Depends(get_db),
) -> PaginatedOperationLogs:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 100)
    rows, total = log_service.list_logs(db, page, page_size, keyword, module, username)
    return PaginatedOperationLogs(
        items=[OperationLogOut.model_validate(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )
