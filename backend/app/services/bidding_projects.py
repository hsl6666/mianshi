from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.timezone import china_now
from app.models import (
    AttachmentType,
    BiddingCompany,
    BiddingProject,
    BiddingProjectGroup,
    ProjectAttachment,
    ProjectStatus,
)


def tender_attachments(project: BiddingProject) -> list[ProjectAttachment]:
    return [a for a in project.attachments if a.company_id is None and a.attachment_type == AttachmentType.tender_doc]


def company_status(company: BiddingCompany, project: BiddingProject, now: datetime | None = None) -> ProjectStatus:
    current = now or china_now()
    if project.bid_opening_at > current:
        return ProjectStatus.registered
    if company.feedback is not None:
        return ProjectStatus.completed
    return ProjectStatus.awaiting_feedback


def sync_project_status(project: BiddingProject, now: datetime | None = None) -> None:
    current = now or china_now()
    companies = list(project.companies or [])
    if not companies:
        if project.bid_opening_at > current:
            project.status = ProjectStatus.registered
        else:
            project.status = ProjectStatus.awaiting_feedback
        return

    statuses = [company_status(company, project, current) for company in companies]
    if all(status == ProjectStatus.completed for status in statuses):
        project.status = ProjectStatus.completed
    elif any(status == ProjectStatus.awaiting_feedback for status in statuses):
        project.status = ProjectStatus.awaiting_feedback
    else:
        project.status = ProjectStatus.registered


def refresh_project_statuses(db: Session, owner: str | None) -> None:
    now = china_now()
    query = select(BiddingProject).join(BiddingProjectGroup).where(BiddingProject.bid_opening_at <= now)
    if owner:
        query = query.where(BiddingProjectGroup.owner == owner)
    rows = db.scalars(
        query.options(
            selectinload(BiddingProject.companies).selectinload(BiddingCompany.feedback),
        )
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
        company_project_ids = select(BiddingCompany.project_id).where(BiddingCompany.name.ilike(like))
        project_filters.append(
            (BiddingProject.name.ilike(like))
            | (BiddingProject.participating_units.ilike(like))
            | BiddingProject.id.in_(company_project_ids)
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
            selectinload(BiddingProjectGroup.projects).selectinload(BiddingProject.attachments),
            selectinload(BiddingProjectGroup.projects)
            .selectinload(BiddingProject.companies)
            .selectinload(BiddingCompany.attachments),
            selectinload(BiddingProjectGroup.projects)
            .selectinload(BiddingProject.companies)
            .selectinload(BiddingCompany.feedback),
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

    now = china_now()
    for group in groups:
        for project in group.projects:
            sync_project_status(project, now)
    db.commit()
    return groups, total


def find_project_by_group_and_name(
    db: Session,
    group_id: int,
    name: str,
    owner: str | None = None,
) -> BiddingProject | None:
    query = (
        select(BiddingProject)
        .join(BiddingProjectGroup)
        .where(BiddingProject.group_id == group_id, BiddingProject.name == name.strip())
        .options(
            selectinload(BiddingProject.attachments),
            selectinload(BiddingProject.companies).selectinload(BiddingCompany.attachments),
        )
    )
    if owner is not None:
        query = query.where(BiddingProjectGroup.owner == owner)
    return db.scalar(query)


def get_project(db: Session, project_id: int, owner: str | None = None) -> BiddingProject | None:
    query = (
        select(BiddingProject)
        .join(BiddingProjectGroup)
        .where(BiddingProject.id == project_id)
        .options(
            selectinload(BiddingProject.group),
            selectinload(BiddingProject.attachments),
            selectinload(BiddingProject.companies).selectinload(BiddingCompany.attachments),
            selectinload(BiddingProject.companies).selectinload(BiddingCompany.feedback),
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
    participating_units: str = "",
    bid_opening_at: datetime,
) -> BiddingProject:
    now = china_now()
    project = BiddingProject(
        group_id=group_id,
        name=name.strip(),
        participating_units=(participating_units or "").strip(),
        bid_opening_at=bid_opening_at,
        status=ProjectStatus.registered,
        created_at=now,
        updated_at=now,
    )
    db.add(project)
    db.flush()
    sync_project_status(project)
    db.commit()
    db.refresh(project)
    return project


def replace_project_attachment(
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
    existing = next(
        (
            a
            for a in project.attachments
            if a.company_id is None and a.attachment_type == attachment_type
        ),
        None,
    )
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
        created_at=china_now(),
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


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


def delete_project(db: Session, project: BiddingProject) -> None:
    db.delete(project)
    db.commit()


def list_form_options(
    db: Session,
    owner: str | None,
    group_id: int | None = None,
) -> tuple[list[str], list[str]]:
    project_query = (
        select(BiddingProject.name)
        .join(BiddingProjectGroup)
        .where(BiddingProject.name.is_not(None))
        .distinct()
        .order_by(BiddingProject.name)
    )
    company_query = (
        select(BiddingCompany.name)
        .join(BiddingProject)
        .join(BiddingProjectGroup)
        .where(BiddingCompany.name.is_not(None))
        .distinct()
        .order_by(BiddingCompany.name)
    )
    if owner:
        project_query = project_query.where(BiddingProjectGroup.owner == owner)
        company_query = company_query.where(BiddingProjectGroup.owner == owner)
    if group_id is not None:
        project_query = project_query.where(BiddingProject.group_id == group_id)
        company_query = company_query.where(BiddingProject.group_id == group_id)

    project_names = [n.strip() for n in db.scalars(project_query).all() if n and n.strip()]
    company_names = [n.strip() for n in db.scalars(company_query).all() if n and n.strip()]
    return project_names, company_names
