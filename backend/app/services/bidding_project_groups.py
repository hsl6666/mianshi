from __future__ import annotations

import logging
from datetime import datetime

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.timezone import china_now
from app.models import AttachmentType, BiddingProject, BiddingProjectGroup, GroupAttachment
from app.schemas import ThirdPartyProjectCreateResponse
from app.services.bidding_projects import sync_project_status
from app.services.third_party_bidding_client import upload_project_bid_file

logger = logging.getLogger(__name__)


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
    project_id: str | None = None,
    evaluation_date: datetime | None = None,
) -> BiddingProjectGroup:
    group = BiddingProjectGroup(
        owner=owner,
        name=name.strip(),
        bid_opening_at=bid_opening_at,
        third_party_project_id=project_id.strip() if project_id else None,
        evaluation_date=evaluation_date,
    )
    db.add(group)
    db.flush()
    group.project_code = f"QZ-{group.id:06d}"
    db.commit()
    db.refresh(group)
    return group


def update_group(
    db: Session,
    group: BiddingProjectGroup,
    *,
    name: str | None = None,
    bid_opening_at: datetime | None = None,
    project_id: str | None = None,
    evaluation_date: datetime | None = None,
    clear_evaluation_date: bool = False,
) -> BiddingProjectGroup:
    if name is not None:
        group.name = name.strip()
    if project_id is not None:
        group.third_party_project_id = project_id.strip() or None
    if evaluation_date is not None:
        group.evaluation_date = evaluation_date
    elif clear_evaluation_date:
        group.evaluation_date = None
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
    third_party_file_name: str | None = None,
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
        third_party_file_name=third_party_file_name or original_name,
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


def apply_third_party_project_sync(
    db: Session,
    group: BiddingProjectGroup,
    response: ThirdPartyProjectCreateResponse,
) -> BiddingProjectGroup:
    project = response.project
    return apply_third_party_metadata(
        db,
        group,
        third_party_db_id=str(project.db_id),
        project_code=project.project_code,
        project_id=project.project_id,
    )


def apply_third_party_metadata(
    db: Session,
    group: BiddingProjectGroup,
    *,
    third_party_db_id: str,
    project_code: str | None = None,
    project_id: str | None = None,
) -> BiddingProjectGroup:
    group.third_party_db_id = third_party_db_id
    if project_id:
        group.third_party_project_id = project_id
    if project_code:
        group.project_code = project_code
    db.commit()
    db.refresh(group)
    return group


async def sync_tender_to_third_party(
    db: Session,
    group: BiddingProjectGroup,
    *,
    stored_name: str,
    bid_file_name: str,
    bid_file_content_type: str | None,
    third_party_file_name: str | None,
    access_token: str,
    project_id: str | None = None,
) -> BiddingProjectGroup:
    settings = get_settings()
    bid_path = settings.uploads_dir / stored_name
    if not bid_path.exists():
        raise ValueError("招标文件不存在，无法同步至第三方")

    try:
        response = await upload_project_bid_file(
            base_url=settings.third_party_api_base_url,
            access_token=access_token,
            bid_file_name=bid_file_name,
            bid_file_bytes=bid_path.read_bytes(),
            bid_file_content_type=bid_file_content_type,
            project_name=group.name,
            project_id=project_id or group.third_party_project_id,
            third_party_file_name=third_party_file_name,
            bid_opening_time=group.bid_opening_at,
            evaluation_date=group.evaluation_date,
        )
    except httpx.HTTPStatusError as exc:
        detail = exc.response.text.strip() or exc.response.reason_phrase
        raise ValueError(f"第三方上传失败（{exc.response.status_code}）：{detail}") from exc
    except httpx.HTTPError as exc:
        raise ValueError(f"第三方上传请求失败：{exc}") from exc

    synced = apply_third_party_project_sync(db, group, response)
    logger.info(
        "项目组 %s 已同步至第三方，third_party_db_id=%s project_code=%s",
        group.id,
        synced.third_party_db_id,
        synced.project_code,
    )
    return synced
