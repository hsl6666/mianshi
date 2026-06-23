from __future__ import annotations

import json
from typing import Literal

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.timezone import china_now
from app.models import (
    BiddingCompany,
    BiddingProject,
    BiddingProjectGroup,
    ProjectAttachment,
    ReportFeedbackEntry,
    ReportFeedbackTag,
)

FeedbackType = Literal["like", "dislike", "report_suggestion"]

DEFAULT_TAGS: dict[str, list[str]] = {
    "like": ["定位准确", "建议可执行", "判断逻辑清晰", "贴合项目实际", "表述专业"],
    "dislike": ["定位不清", "建议过于笼统", "与实际情况不符", "缺少依据来源", "判断逻辑有偏差"],
}


def seed_default_tags(db: Session) -> None:
    existing = db.scalar(select(func.count()).select_from(ReportFeedbackTag))
    if existing:
        return
    for feedback_type, labels in DEFAULT_TAGS.items():
        for index, label in enumerate(labels):
            db.add(
                ReportFeedbackTag(
                    feedback_type=feedback_type,
                    label=label,
                    sort_order=index,
                    is_active=True,
                )
            )
    db.commit()


def list_active_tags(db: Session, feedback_type: str | None = None) -> list[ReportFeedbackTag]:
    query = select(ReportFeedbackTag).where(ReportFeedbackTag.is_active.is_(True))
    if feedback_type:
        query = query.where(ReportFeedbackTag.feedback_type == feedback_type)
    query = query.order_by(ReportFeedbackTag.feedback_type, ReportFeedbackTag.sort_order, ReportFeedbackTag.id)
    return list(db.scalars(query))


def list_all_tags(db: Session) -> list[ReportFeedbackTag]:
    query = select(ReportFeedbackTag).order_by(
        ReportFeedbackTag.feedback_type,
        ReportFeedbackTag.sort_order,
        ReportFeedbackTag.id,
    )
    return list(db.scalars(query))


def create_tag(
    db: Session,
    *,
    feedback_type: str,
    label: str,
    sort_order: int = 0,
    is_active: bool = True,
) -> ReportFeedbackTag:
    tag = ReportFeedbackTag(
        feedback_type=feedback_type.strip(),
        label=label.strip(),
        sort_order=sort_order,
        is_active=is_active,
    )
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


def update_tag(
    db: Session,
    tag: ReportFeedbackTag,
    *,
    feedback_type: str | None = None,
    label: str | None = None,
    sort_order: int | None = None,
    is_active: bool | None = None,
) -> ReportFeedbackTag:
    if feedback_type is not None:
        tag.feedback_type = feedback_type.strip()
    if label is not None:
        tag.label = label.strip()
    if sort_order is not None:
        tag.sort_order = sort_order
    if is_active is not None:
        tag.is_active = is_active
    tag.updated_at = china_now()
    db.commit()
    db.refresh(tag)
    return tag


def delete_tag(db: Session, tag: ReportFeedbackTag) -> None:
    db.delete(tag)
    db.commit()


def get_tag(db: Session, tag_id: int) -> ReportFeedbackTag | None:
    return db.get(ReportFeedbackTag, tag_id)


def _active_tag_labels(db: Session, feedback_type: str) -> list[str]:
    return [tag.label for tag in list_active_tags(db, feedback_type)]


def split_comment_tags(db: Session, feedback_type: str, comment: str | None) -> tuple[list[str], str]:
    if not comment:
        return [], ""
    known_tags = _active_tag_labels(db, feedback_type)
    parts = [part.strip() for part in comment.replace("，", "；").split("；") if part.strip()]
    selected_tags: list[str] = []
    free_text_parts: list[str] = []
    for part in parts:
        if part in known_tags and part not in selected_tags:
            selected_tags.append(part)
        else:
            free_text_parts.append(part)
    return selected_tags, "；".join(free_text_parts)


def _entry_query():
    return (
        select(ReportFeedbackEntry)
        .join(ProjectAttachment, ReportFeedbackEntry.attachment_id == ProjectAttachment.id)
        .join(BiddingCompany, ProjectAttachment.company_id == BiddingCompany.id)
        .join(BiddingProject, BiddingCompany.project_id == BiddingProject.id)
        .join(BiddingProjectGroup, BiddingProject.group_id == BiddingProjectGroup.id)
        .options(
            selectinload(ReportFeedbackEntry.attachment)
            .selectinload(ProjectAttachment.company)
            .selectinload(BiddingCompany.project)
            .selectinload(BiddingProject.group),
        )
    )


def list_entries(
    db: Session,
    *,
    page: int = 1,
    page_size: int = 20,
    keyword: str | None = None,
    feedback_type: str | None = None,
    project_id: int | None = None,
) -> tuple[list[ReportFeedbackEntry], int]:
    filters = []
    if feedback_type:
        filters.append(ReportFeedbackEntry.feedback_type == feedback_type)
    if project_id:
        filters.append(BiddingProject.id == project_id)
    if keyword:
        like = f"%{keyword.strip()}%"
        filters.append(
            or_(
                BiddingProject.name.ilike(like),
                BiddingCompany.name.ilike(like),
                ReportFeedbackEntry.comment.ilike(like),
                ReportFeedbackEntry.tags_json.ilike(like),
            )
        )

    count_stmt = (
        select(func.count(ReportFeedbackEntry.id))
        .join(ProjectAttachment, ReportFeedbackEntry.attachment_id == ProjectAttachment.id)
        .join(BiddingCompany, ProjectAttachment.company_id == BiddingCompany.id)
        .join(BiddingProject, BiddingCompany.project_id == BiddingProject.id)
        .join(BiddingProjectGroup, BiddingProject.group_id == BiddingProjectGroup.id)
    )
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = int(db.scalar(count_stmt) or 0)

    query = _entry_query()
    if filters:
        query = query.where(*filters)
    rows = db.scalars(
        query.order_by(ReportFeedbackEntry.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return list(rows), total


def get_entry(db: Session, entry_id: int) -> ReportFeedbackEntry | None:
    return db.scalar(_entry_query().where(ReportFeedbackEntry.id == entry_id))


def delete_entry(db: Session, entry: ReportFeedbackEntry) -> None:
    db.delete(entry)
    db.commit()


def _find_entry(
    db: Session,
    attachment_id: int,
    issue_id: str | None,
) -> ReportFeedbackEntry | None:
    query = select(ReportFeedbackEntry).where(ReportFeedbackEntry.attachment_id == attachment_id)
    if issue_id:
        query = query.where(ReportFeedbackEntry.issue_id == issue_id)
    else:
        query = query.where(or_(ReportFeedbackEntry.issue_id.is_(None), ReportFeedbackEntry.issue_id == ""))
    return db.scalar(query)


def upsert_issue_feedback_entry(
    db: Session,
    attachment: ProjectAttachment,
    *,
    issue_id: str,
    feedback_type: str,
    comment: str | None,
    created_by: str | None = None,
) -> None:
    entry = _find_entry(db, attachment.id, issue_id)
    if feedback_type not in {"like", "dislike"}:
        return

    if not comment:
        if entry:
            db.delete(entry)
            db.commit()
        return

    tags, free_text = split_comment_tags(db, feedback_type, comment)
    payload_tags = json.dumps(tags, ensure_ascii=False)
    now = china_now()
    if entry is None:
        entry = ReportFeedbackEntry(
            attachment_id=attachment.id,
            issue_id=issue_id,
            feedback_type=feedback_type,
            tags_json=payload_tags,
            comment=free_text or None,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        db.add(entry)
    else:
        entry.feedback_type = feedback_type
        entry.tags_json = payload_tags
        entry.comment = free_text or None
        entry.updated_at = now
        if created_by:
            entry.created_by = created_by
    db.commit()


def clear_issue_feedback_entry(db: Session, attachment_id: int, issue_id: str) -> None:
    entry = _find_entry(db, attachment_id, issue_id)
    if entry:
        db.delete(entry)
        db.commit()


def upsert_report_feedback_entry(
    db: Session,
    attachment: ProjectAttachment,
    *,
    comment: str | None,
    created_by: str | None = None,
) -> None:
    entry = _find_entry(db, attachment.id, None)
    normalized = comment.strip() if isinstance(comment, str) else ""
    if not normalized:
        if entry:
            db.delete(entry)
            db.commit()
        return

    now = china_now()
    if entry is None:
        entry = ReportFeedbackEntry(
            attachment_id=attachment.id,
            issue_id=None,
            feedback_type="report_suggestion",
            tags_json=None,
            comment=normalized,
            created_by=created_by,
            created_at=now,
            updated_at=now,
        )
        db.add(entry)
    else:
        entry.feedback_type = "report_suggestion"
        entry.comment = normalized
        entry.updated_at = now
        if created_by:
            entry.created_by = created_by
    db.commit()
