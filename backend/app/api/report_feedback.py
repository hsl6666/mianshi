from __future__ import annotations

import json
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import require_permission
from app.core.security import CurrentUser
from app.db import get_db
from app.models import ReportFeedbackEntry, ReportFeedbackTag
from app.schemas import (
    PaginatedReportFeedbackEntries,
    ReportFeedbackEntryOut,
    ReportFeedbackTagCreate,
    ReportFeedbackTagOut,
    ReportFeedbackTagUpdate,
)
from app.services import report_feedback as feedback_service

router = APIRouter(prefix="/api", tags=["report-feedback"])


def _tag_to_out(tag: ReportFeedbackTag) -> ReportFeedbackTagOut:
    return ReportFeedbackTagOut.model_validate(tag)


def _entry_to_out(entry: ReportFeedbackEntry) -> ReportFeedbackEntryOut:
    attachment = entry.attachment
    company = attachment.company if attachment else None
    project = company.project if company else None
    group = project.group if project else None
    tags: list[str] = []
    if entry.tags_json:
        try:
            parsed = json.loads(entry.tags_json)
            if isinstance(parsed, list):
                tags = [str(item) for item in parsed]
        except json.JSONDecodeError:
            tags = []

    return ReportFeedbackEntryOut(
        id=entry.id,
        attachment_id=entry.attachment_id,
        issue_id=entry.issue_id,
        feedback_type=entry.feedback_type,
        tags=tags,
        comment=entry.comment,
        created_by=entry.created_by,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
        project_id=project.id if project else None,
        project_name=project.name if project else None,
        company_name=company.name if company else None,
        version_number=attachment.version_number if attachment else None,
        group_name=group.name if group else None,
        report_url=f"/technical-report-2?version_id={entry.attachment_id}",
    )


@router.get("/public/report-feedback-tags", response_model=list[ReportFeedbackTagOut])
def list_public_report_feedback_tags(
    feedback_type: Optional[Literal["like", "dislike"]] = Query(default=None),
    db: Session = Depends(get_db),
) -> list[ReportFeedbackTagOut]:
    tags = feedback_service.list_active_tags(db, feedback_type)
    return [_tag_to_out(tag) for tag in tags]


@router.get(
    "/report-feedback/tags",
    response_model=list[ReportFeedbackTagOut],
    dependencies=[Depends(require_permission("report_feedback", "manage_tags"))],
)
def list_report_feedback_tags(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("report_feedback", "manage_tags")),
) -> list[ReportFeedbackTagOut]:
    del current_user
    tags = feedback_service.list_all_tags(db)
    return [_tag_to_out(tag) for tag in tags]


@router.post(
    "/report-feedback/tags",
    response_model=ReportFeedbackTagOut,
    dependencies=[Depends(require_permission("report_feedback", "manage_tags"))],
)
def create_report_feedback_tag(
    payload: ReportFeedbackTagCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("report_feedback", "manage_tags")),
) -> ReportFeedbackTagOut:
    del current_user
    tag = feedback_service.create_tag(
        db,
        feedback_type=payload.feedback_type,
        label=payload.label,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    return _tag_to_out(tag)


@router.patch(
    "/report-feedback/tags/{tag_id}",
    response_model=ReportFeedbackTagOut,
    dependencies=[Depends(require_permission("report_feedback", "manage_tags"))],
)
def update_report_feedback_tag(
    tag_id: int,
    payload: ReportFeedbackTagUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("report_feedback", "manage_tags")),
) -> ReportFeedbackTagOut:
    del current_user
    tag = feedback_service.get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    updated = feedback_service.update_tag(
        db,
        tag,
        feedback_type=payload.feedback_type,
        label=payload.label,
        sort_order=payload.sort_order,
        is_active=payload.is_active,
    )
    return _tag_to_out(updated)


@router.delete(
    "/report-feedback/tags/{tag_id}",
    dependencies=[Depends(require_permission("report_feedback", "manage_tags"))],
)
def delete_report_feedback_tag(
    tag_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("report_feedback", "manage_tags")),
) -> dict[str, bool]:
    del current_user
    tag = feedback_service.get_tag(db, tag_id)
    if not tag:
        raise HTTPException(status_code=404, detail="标签不存在")
    feedback_service.delete_tag(db, tag)
    return {"ok": True}


@router.get(
    "/report-feedback/entries",
    response_model=PaginatedReportFeedbackEntries,
    dependencies=[Depends(require_permission("report_feedback", "view"))],
)
def list_report_feedback_entries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    keyword: Optional[str] = Query(default=None),
    feedback_type: Optional[str] = Query(default=None),
    project_id: Optional[int] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("report_feedback", "view")),
) -> PaginatedReportFeedbackEntries:
    del current_user
    items, total = feedback_service.list_entries(
        db,
        page=page,
        page_size=page_size,
        keyword=keyword,
        feedback_type=feedback_type,
        project_id=project_id,
    )
    return PaginatedReportFeedbackEntries(
        items=[_entry_to_out(item) for item in items],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.delete(
    "/report-feedback/entries/{entry_id}",
    dependencies=[Depends(require_permission("report_feedback", "delete"))],
)
def delete_report_feedback_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("report_feedback", "delete")),
) -> dict[str, bool]:
    del current_user
    entry = feedback_service.get_entry(db, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="反馈记录不存在")
    feedback_service.delete_entry(db, entry)
    return {"ok": True}
