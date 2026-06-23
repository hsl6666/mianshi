from datetime import datetime

from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user, require_permission, require_super_admin
from app.core.config import get_settings
from app.core.security import CurrentUser
from app.db import get_db
from app.models import AttachmentType
from app.schemas import GroupCreate, GroupDetail, GroupListItem, GroupThirdPartySync, GroupUpdate
from app.services import bidding_project_groups as group_service
from app.services import operation_logs as log_service
from app.services.bidding_serializers import group_to_detail, group_to_list_item
from app.services.files import save_upload

router = APIRouter(
    prefix="/api/bidding-project-groups",
    tags=["bidding-project-groups"],
    dependencies=[Depends(require_permission("bidding", "view"))],
)


@router.get("", response_model=list[GroupListItem])
def list_groups(
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[GroupListItem]:
    rows = group_service.list_groups(db, current_user.owner_filter, keyword)
    return [group_to_list_item(row) for row in rows]


@router.get("/{group_id}", response_model=GroupDetail)
def get_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> GroupDetail:
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    return group_to_detail(group)


@router.post("", response_model=GroupDetail, status_code=201, dependencies=[Depends(require_permission("bidding", "create"))])
async def create_group(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    project_name: str = Form(...),
    bid_opening_time: Optional[datetime] = Form(None),
    project_id: Optional[str] = Form(None),
    third_party_file_name: Optional[str] = Form(None),
    evaluation_date: Optional[datetime] = Form(None),
    bid_file: Optional[UploadFile] = File(None),
) -> GroupDetail:
    if not bid_file or not bid_file.filename:
        raise HTTPException(status_code=400, detail="请上传招标文件")
    if not bid_opening_time:
        raise HTTPException(status_code=400, detail="请选择开标时间")

    try:
        payload = GroupCreate(
            project_name=project_name,
            bid_opening_time=bid_opening_time,
            project_id=project_id,
            evaluation_date=evaluation_date,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group = group_service.create_group(
        db,
        owner=current_user.username,
        name=payload.project_name,
        bid_opening_at=payload.bid_opening_time,
        project_id=payload.project_id,
        evaluation_date=payload.evaluation_date,
    )
    group = group_service.get_group(db, group.id, current_user.owner_filter)
    assert group is not None

    try:
        stored_name, original_name, size_bytes, content_type = await save_upload(
            bid_file, group.id, prefix="group"
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
        third_party_file_name=third_party_file_name or original_name,
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
    return group_to_detail(group)


@router.patch(
    "/{group_id}/third-party",
    response_model=GroupDetail,
    dependencies=[Depends(require_permission("bidding", "edit"))],
)
def sync_group_third_party(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    third_party_db_id: str = Form(...),
    project_code: Optional[str] = Form(None),
    project_id: Optional[str] = Form(None),
) -> GroupDetail:
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    try:
        payload = GroupThirdPartySync(
            third_party_db_id=third_party_db_id,
            project_code=project_code,
            project_id=project_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group_service.apply_third_party_metadata(
        db,
        group,
        third_party_db_id=payload.third_party_db_id,
        project_code=payload.project_code,
        project_id=payload.project_id,
    )
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    assert group is not None
    log_service.record_log(
        db,
        username=current_user.username,
        action="sync",
        module="bidding",
        resource_type="group",
        resource_id=group.id,
        summary=f"绑定第三方项目 {payload.third_party_db_id}",
        detail={
            "third_party_db_id": payload.third_party_db_id,
            "project_code": payload.project_code,
            "project_id": payload.project_id,
        },
        ip_address=get_client_ip(request),
    )
    return group_to_detail(group, third_party_synced=True)


@router.patch("/{group_id}", response_model=GroupDetail, dependencies=[Depends(require_permission("bidding", "edit"))])
def update_group(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    project_name: str = Form(...),
    bid_opening_time: datetime = Form(...),
    project_id: Optional[str] = Form(None),
    evaluation_date: Optional[datetime] = Form(None),
) -> GroupDetail:
    group = group_service.get_group(db, group_id, current_user.owner_filter)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    try:
        payload = GroupUpdate(
            project_name=project_name,
            bid_opening_time=bid_opening_time,
            project_id=project_id,
            evaluation_date=evaluation_date,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    group_service.update_group(
        db,
        group,
        name=payload.project_name,
        bid_opening_at=payload.bid_opening_time,
        project_id=payload.project_id,
        evaluation_date=payload.evaluation_date,
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
    return group_to_detail(group)


@router.delete("/{group_id}", status_code=204)
def delete_group(
    group_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_super_admin),
) -> None:
    group = group_service.get_group(db, group_id, None)
    if not group:
        raise HTTPException(status_code=404, detail="项目组不存在")
    name = group.name
    project_count = len(group.projects)
    attachment_count = len(group.attachments)
    group_service.delete_group(db, group)
    log_service.record_log(
        db,
        username=current_user.username,
        action="delete",
        module="bidding",
        resource_type="group",
        resource_id=group_id,
        summary=f"删除项目组 {name}",
        detail={"project_count": project_count, "attachment_count": attachment_count},
        ip_address=get_client_ip(request),
    )


@router.get("/{group_id}/attachments/{attachment_id}/download", dependencies=[Depends(require_permission("bidding", "download"))])
def download_group_attachment(
    group_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "download")),
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
