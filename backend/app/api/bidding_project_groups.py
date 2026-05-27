from datetime import datetime

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.core.config import get_settings
from app.core.security import CurrentUser
from app.db import get_db
from app.models import AttachmentType
from app.schemas import GroupCreate, GroupDetail, GroupListItem, GroupUpdate
from app.services import bidding_project_groups as group_service
from app.services import operation_logs as log_service
from app.services.files import save_upload

router = APIRouter(
    prefix="/api/bidding-project-groups",
    tags=["bidding-project-groups"],
    dependencies=[Depends(get_current_user)],
)


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
    current_user: CurrentUser = Depends(get_current_user),
) -> list[GroupListItem]:
    rows = group_service.list_groups(db, current_user.owner_filter, keyword)
    return [_to_list_item(row) for row in rows]


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> GroupDetail:
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    return GroupDetail.model_validate(group)


@router.post("", response_model=GroupDetail, status_code=201)
async def create_group(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    name: str = Form(...),
    bid_opening_at: Optional[datetime] = Form(None),
    tender_doc: Optional[UploadFile] = File(None),
    bid_doc: Optional[UploadFile] = File(None),
) -> GroupDetail:
    if not tender_doc or not tender_doc.filename:
        raise HTTPException(status_code=400, detail="请上传招标文件")
    if not bid_opening_at:
        raise HTTPException(status_code=400, detail="请选择开标时间")

    resolved_opening_at = bid_opening_at
    try:
        payload = GroupCreate(name=name, bid_opening_at=resolved_opening_at)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group = group_service.create_group(
        db,
        owner=current_user.username,
        name=payload.name,
        bid_opening_at=payload.bid_opening_at,
    )
    group = group_service.get_group(db, group.id, current_user.owner_filter)
    assert group is not None

    try:
        stored_name, original_name, size_bytes, content_type = await save_upload(
            tender_doc, group.id, prefix="group"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    group_service.replace_attachment(
        db,
        group,
        AttachmentType.tender_doc,
        original_name=original_name,
        stored_name=stored_name,
        size_bytes=size_bytes,
        content_type=content_type,
    )
    group = group_service.get_group(db, group.id, current_user.owner_filter)
    assert group is not None

    if bid_doc and bid_doc.filename:
        try:
            stored_name, original_name, size_bytes, content_type = await save_upload(
                bid_doc, group.id, prefix="group"
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        group_service.replace_attachment(
            db,
            group,
            AttachmentType.bid_doc,
            original_name=original_name,
            stored_name=stored_name,
            size_bytes=size_bytes,
            content_type=content_type,
        )
        group = group_service.get_group(db, group.id, current_user.owner_filter)
        assert group is not None

    log_service.record_log(
        db,
        username=current_user.username,
        action="create",
        module="bidding",
        resource_type="group",
        resource_id=group.id,
        summary=f"创建项目组 {group.name}",
        ip_address=get_client_ip(request),
    )
    return GroupDetail.model_validate(group)


@router.patch("/{group_id}", response_model=GroupDetail)
def update_group(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    name: str = Form(...),
    bid_opening_at: datetime = Form(...),
) -> GroupDetail:
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    try:
        payload = GroupUpdate(name=name, bid_opening_at=bid_opening_at)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group_service.update_group(
        db,
        group,
        name=payload.name,
        bid_opening_at=payload.bid_opening_at,
    )
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    assert group is not None
    log_service.record_log(
        db,
        username=current_user.username,
        action="update",
        module="bidding",
        resource_type="group",
        resource_id=group.id,
        summary=f"更新项目组 {group.name}",
        ip_address=get_client_ip(request),
    )
    return GroupDetail.model_validate(group)


@router.get("/{group_id}/attachments/{attachment_id}/download")
def download_group_attachment(
    group_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    group = group_service.get_group(db, group_id, current_user.owner_filter)
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
