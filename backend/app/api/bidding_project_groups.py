from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import AttachmentType
from app.schemas import GroupCreate, GroupDetail, GroupListItem, GroupUpdate
from app.services import bidding_project_groups as group_service
from app.services.files import save_upload

router = APIRouter(prefix="/api/bidding-project-groups", tags=["bidding-project-groups"])


def _to_list_item(group) -> GroupListItem:
    return GroupListItem(
        id=group.id,
        name=group.name,
        bid_opening_at=group.bid_opening_at,
        created_at=group.created_at,
        updated_at=group.updated_at,
        attachment_count=len(group.attachments),
        project_count=len(group.projects),
    )


@router.get("", response_model=list[GroupListItem])
def list_groups(
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
) -> list[GroupListItem]:
    rows = group_service.list_groups(db, keyword)
    return [_to_list_item(row) for row in rows]


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(group_id: int, db: Session = Depends(get_db)) -> GroupDetail:
    group = group_service.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    return GroupDetail.model_validate(group)


@router.post("", response_model=GroupDetail, status_code=201)
async def create_group(
    name: str = Form(...),
    bid_opening_at: Optional[datetime] = Form(None),
    tender_doc: Optional[UploadFile] = File(None),
    bid_doc: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
) -> GroupDetail:
    resolved_opening_at = bid_opening_at or datetime.now()
    try:
        payload = GroupCreate(name=name, bid_opening_at=resolved_opening_at)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group = group_service.create_group(
        db,
        name=payload.name,
        bid_opening_at=payload.bid_opening_at,
    )
    group = group_service.get_group(db, group.id)
    assert group is not None

    for upload, attachment_type in ((tender_doc, AttachmentType.tender_doc), (bid_doc, AttachmentType.bid_doc)):
        if upload and upload.filename:
            try:
                stored_name, original_name, size_bytes, content_type = await save_upload(upload, group.id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            group_service.replace_attachment(
                db,
                group,
                attachment_type,
                original_name=original_name,
                stored_name=stored_name,
                size_bytes=size_bytes,
                content_type=content_type,
            )
            group = group_service.get_group(db, group.id)
            assert group is not None

    return GroupDetail.model_validate(group)


@router.patch("/{group_id}", response_model=GroupDetail)
def update_group(
    group_id: int,
    name: str = Form(...),
    db: Session = Depends(get_db),
) -> GroupDetail:
    group = group_service.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    try:
        payload = GroupUpdate(name=name)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group_service.update_group(db, group, name=payload.name)
    group = group_service.get_group(db, group_id)
    assert group is not None
    return GroupDetail.model_validate(group)


@router.get("/{group_id}/attachments/{attachment_id}/download")
def download_group_attachment(
    group_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    group = group_service.get_group(db, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    attachment = next((a for a in group.attachments if a.id == attachment_id), None)
    if not attachment:
        raise HTTPException(status_code=404, detail="附件不存在")
    settings = get_settings()
    file_path = settings.uploads_dir / attachment.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(
        path=file_path,
        filename=attachment.original_name,
        media_type=attachment.content_type or "application/octet-stream",
    )
