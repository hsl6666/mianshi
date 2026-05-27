from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.timezone import china_now
from app.models import AttachmentType, BiddingProject, BiddingProjectGroup, GroupAttachment
from app.services.bidding_projects import sync_project_status


def list_groups(db: Session, owner: str | None, keyword: str | None = None) -> list[BiddingProjectGroup]:
    query = select(BiddingProjectGroup)
    if owner:
        query = query.where(BiddingProjectGroup.owner == owner)
    query = (
        query
        .options(
            selectinload(BiddingProjectGroup.attachments),
            selectinload(BiddingProjectGroup.projects),
        )
    )
    if keyword:
        like = f"%{keyword.strip()}%"
        query = query.where(BiddingProjectGroup.name.ilike(like))
    return (
        db.scalars(query.order_by(BiddingProjectGroup.bid_opening_at.desc(), BiddingProjectGroup.id.desc()))
        .unique()
        .all()
    )


def get_group(db: Session, group_id: int, owner: str | None = None) -> BiddingProjectGroup | None:
    query = (
        select(BiddingProjectGroup)
        .where(BiddingProjectGroup.id == group_id)
        .options(selectinload(BiddingProjectGroup.attachments))
    )
    if owner is not None:
        query = query.where(BiddingProjectGroup.owner == owner)
    return db.scalar(query)


def create_group(
    db: Session,
    *,
    owner: str,
    name: str,
    bid_opening_at: datetime,
) -> BiddingProjectGroup:
    group = BiddingProjectGroup(
        owner=owner,
        name=name.strip(),
        bid_opening_at=bid_opening_at,
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group


def update_group(
    db: Session,
    group: BiddingProjectGroup,
    *,
    name: str | None = None,
    bid_opening_at: datetime | None = None,
) -> BiddingProjectGroup:
    if name is not None:
        group.name = name.strip()
    if bid_opening_at is not None:
        group.bid_opening_at = bid_opening_at
        projects = db.scalars(select(BiddingProject).where(BiddingProject.group_id == group.id)).all()
        for project in projects:
            project.bid_opening_at = bid_opening_at
            sync_project_status(project)
    db.commit()
    db.refresh(group)
    return group


def replace_attachment(
    db: Session,
    group: BiddingProjectGroup,
    attachment_type: AttachmentType,
    *,
    original_name: str,
    stored_name: str,
    size_bytes: int,
    content_type: str | None,
) -> GroupAttachment:
    settings = get_settings()
    existing = next((a for a in group.attachments if a.attachment_type == attachment_type), None)
    if existing:
        old_path = settings.uploads_dir / existing.stored_name
        if old_path.exists():
            old_path.unlink()
        db.delete(existing)
        db.flush()
    attachment = GroupAttachment(
        group_id=group.id,
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


def delete_group(db: Session, group: BiddingProjectGroup) -> None:
    db.delete(group)
    db.commit()
