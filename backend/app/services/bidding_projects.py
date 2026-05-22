from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.models import AttachmentType, BiddingProject, ProjectAttachment, ProjectFeedback, ProjectStatus


def sync_project_status(project: BiddingProject, now: datetime | None = None) -> None:
    if project.feedback is not None:
        project.status = ProjectStatus.completed
        return
    current = now or datetime.now()
    if project.bid_opening_at <= current:
        project.status = ProjectStatus.awaiting_feedback
    else:
        project.status = ProjectStatus.registered


def refresh_project_statuses(db: Session) -> None:
    """将已到开标时间且未反馈的项目标记为待反馈。"""
    now = datetime.now()
    rows = db.scalars(
        select(BiddingProject)
        .where(BiddingProject.bid_opening_at <= now)
        .options(selectinload(BiddingProject.feedback))
    ).all()
    changed = False
    for project in rows:
        before = project.status
        sync_project_status(project, now)
        if project.status != before:
            changed = True
    if changed:
        db.commit()


def list_projects(
    db: Session,
    page: int,
    page_size: int,
    keyword: str | None,
    status: ProjectStatus | None = None,
) -> tuple[list[BiddingProject], int]:
    refresh_project_statuses(db)
    filters = []
    if keyword:
        like = f"%{keyword.strip()}%"
        filters.append((BiddingProject.name.ilike(like)) | (BiddingProject.participating_units.ilike(like)))
    if status is not None:
        filters.append(BiddingProject.status == status)

    count_stmt = select(func.count(BiddingProject.id))
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = db.scalar(count_stmt) or 0

    query = select(BiddingProject).options(
        selectinload(BiddingProject.feedback),
        selectinload(BiddingProject.attachments),
    )
    if filters:
        query = query.where(*filters)
    rows = (
        db.scalars(
            query.order_by(BiddingProject.bid_opening_at.desc(), BiddingProject.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )
    now = datetime.now()
    for project in rows:
        sync_project_status(project, now)
    db.commit()
    return rows, total


def get_project(db: Session, project_id: int) -> BiddingProject | None:
    project = db.scalar(
        select(BiddingProject)
        .where(BiddingProject.id == project_id)
        .options(
            selectinload(BiddingProject.attachments),
            selectinload(BiddingProject.feedback),
        )
    )
    if project:
        sync_project_status(project)
        db.commit()
    return project


def create_project(
    db: Session,
    *,
    name: str,
    participating_units: str,
    bid_opening_at: datetime,
) -> BiddingProject:
    project = BiddingProject(
        name=name.strip(),
        participating_units=participating_units.strip(),
        bid_opening_at=bid_opening_at,
        status=ProjectStatus.registered,
    )
    db.add(project)
    db.flush()
    sync_project_status(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(
    db: Session,
    project: BiddingProject,
    *,
    name: str | None = None,
    participating_units: str | None = None,
    bid_opening_at: datetime | None = None,
) -> BiddingProject:
    if project.feedback is not None:
        raise ValueError("项目已完成评审反馈，无法修改基础信息")
    if name is not None:
        project.name = name.strip()
    if participating_units is not None:
        project.participating_units = participating_units.strip()
    if bid_opening_at is not None:
        project.bid_opening_at = bid_opening_at
    sync_project_status(project)
    db.commit()
    db.refresh(project)
    return project


def replace_attachment(
    db: Session,
    project: BiddingProject,
    attachment_type: AttachmentType,
    *,
    original_name: str,
    stored_name: str,
    size_bytes: int,
    content_type: str | None,
) -> ProjectAttachment:
    settings = get_settings()
    existing = next((a for a in project.attachments if a.attachment_type == attachment_type), None)
    if existing:
        old_path = settings.uploads_dir / existing.stored_name
        if old_path.exists():
            old_path.unlink()
        db.delete(existing)
        db.flush()
    attachment = ProjectAttachment(
        project_id=project.id,
        attachment_type=attachment_type,
        original_name=original_name,
        stored_name=stored_name,
        size_bytes=size_bytes,
        content_type=content_type,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


def submit_feedback(
    db: Session,
    project: BiddingProject,
    *,
    final_score: float,
    ranking: int | None,
    score_detail: str | None,
    remark: str | None,
) -> ProjectFeedback:
    if project.status == ProjectStatus.registered:
        raise ValueError("开标时间未到，暂不可提交评审反馈")
    if project.feedback is not None:
        project.feedback.final_score = final_score
        project.feedback.ranking = ranking
        project.feedback.score_detail = score_detail
        project.feedback.remark = remark
        feedback = project.feedback
    else:
        feedback = ProjectFeedback(
            project_id=project.id,
            final_score=final_score,
            ranking=ranking,
            score_detail=score_detail,
            remark=remark,
        )
        db.add(feedback)
    sync_project_status(project)
    db.commit()
    db.refresh(feedback)
    return feedback


def delete_project(db: Session, project: BiddingProject) -> None:
    db.delete(project)
    db.commit()
