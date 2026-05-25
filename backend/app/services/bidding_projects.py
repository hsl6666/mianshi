from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import BiddingProject, BiddingProjectGroup, ProjectFeedback, ProjectStatus


def sync_project_status(project: BiddingProject, now: datetime | None = None) -> None:
    if project.feedback is not None:
        project.status = ProjectStatus.completed
        return
    current = now or datetime.now()
    if project.bid_opening_at <= current:
        project.status = ProjectStatus.awaiting_feedback
    else:
        project.status = ProjectStatus.registered


def refresh_project_statuses(db: Session, owner: str | None) -> None:
    now = datetime.now()
    query = select(BiddingProject).join(BiddingProjectGroup).where(BiddingProject.bid_opening_at <= now)
    if owner:
        query = query.where(BiddingProjectGroup.owner == owner)
    rows = db.scalars(
        query
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


def list_project_tree(
    db: Session,
    owner: str | None,
    page: int,
    page_size: int,
    keyword: str | None,
    status: ProjectStatus | None = None,
) -> tuple[list[BiddingProjectGroup], int]:
    refresh_project_statuses(db, owner)

    group_filters = []
    if owner:
        group_filters.append(BiddingProjectGroup.owner == owner)
    project_filters = []
    if keyword:
        like = f"%{keyword.strip()}%"
        group_filters.append(BiddingProjectGroup.name.ilike(like))
        project_filters.append(
            (BiddingProject.name.ilike(like)) | (BiddingProject.participating_units.ilike(like))
        )
    if status is not None:
        project_filters.append(BiddingProject.status == status)

    if project_filters:
        group_ids_query = select(BiddingProject.group_id).join(BiddingProjectGroup).where(*project_filters)
        if owner:
            group_ids_query = group_ids_query.where(BiddingProjectGroup.owner == owner)
        group_ids_stmt = group_ids_query.distinct()
        group_filters.append(BiddingProjectGroup.id.in_(group_ids_stmt))

    count_stmt = select(func.count(BiddingProjectGroup.id)).where(*group_filters)
    total = db.scalar(count_stmt) or 0

    query = (
        select(BiddingProjectGroup)
        .where(*group_filters)
        .options(
            selectinload(BiddingProjectGroup.attachments),
            selectinload(BiddingProjectGroup.projects).selectinload(BiddingProject.feedback),
        )
    )

    groups = (
        db.scalars(
            query.order_by(BiddingProjectGroup.bid_opening_at.desc(), BiddingProjectGroup.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .unique()
        .all()
    )

    now = datetime.now()
    for group in groups:
        for project in group.projects:
            sync_project_status(project, now)
    db.commit()
    return groups, total


def get_project(db: Session, project_id: int, owner: str | None = None) -> BiddingProject | None:
    query = (
        select(BiddingProject)
        .join(BiddingProjectGroup)
        .where(BiddingProject.id == project_id)
        .options(
            selectinload(BiddingProject.group).selectinload(BiddingProjectGroup.attachments),
            selectinload(BiddingProject.feedback),
        )
    )
    if owner is not None:
        query = query.where(BiddingProjectGroup.owner == owner)
    project = db.scalar(query)
    if project:
        sync_project_status(project)
        db.commit()
    return project


def create_project(
    db: Session,
    *,
    group_id: int,
    name: str,
    participating_units: str,
    bid_opening_at: datetime,
) -> BiddingProject:
    project = BiddingProject(
        group_id=group_id,
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
