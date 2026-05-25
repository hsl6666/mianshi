from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.core.security import CurrentUser
from app.db import get_db
from app.models import AttachmentType, BiddingProject, ProjectStatus
from app.schemas import (
    FeedbackCreate,
    FeedbackOut,
    GroupTreeItem,
    PaginatedProjectTree,
    ProjectCreate,
    ProjectDetail,
    ProjectListItem,
    ProjectUpdate,
)
from app.services import bidding_project_groups as group_service
from app.services import bidding_projects as service
from app.services import operation_logs as log_service
from app.services.files import save_upload

router = APIRouter(
    prefix="/api/bidding-projects",
    tags=["bidding-projects"],
    dependencies=[Depends(get_current_user)],
)


def _to_project_item(project: BiddingProject) -> ProjectListItem:
    return ProjectListItem(
        id=project.id,
        group_id=project.group_id,
        name=project.name,
        participating_units=project.participating_units,
        bid_opening_at=project.bid_opening_at,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        final_score=float(project.feedback.final_score) if project.feedback else None,
        ranking=project.feedback.ranking if project.feedback else None,
    )


def _to_group_tree_item(group) -> GroupTreeItem:
    children = sorted(group.projects, key=lambda p: p.id, reverse=True)
    return GroupTreeItem(
        id=group.id,
        name=group.name,
        bid_opening_at=group.bid_opening_at,
        created_at=group.created_at,
        updated_at=group.updated_at,
        attachment_count=len(group.attachments),
        children=[_to_project_item(child) for child in children],
    )


def _to_detail(project: BiddingProject) -> ProjectDetail:
    return ProjectDetail(
        id=project.id,
        group_id=project.group_id,
        group_name=project.group.name,
        name=project.name,
        participating_units=project.participating_units,
        bid_opening_at=project.bid_opening_at,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        attachments=project.group.attachments,
        feedback=project.feedback,
    )


@router.get("", response_model=PaginatedProjectTree)
def list_bidding_projects(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    status: Optional[ProjectStatus] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedProjectTree:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    rows, total = service.list_project_tree(
        db, current_user.owner_filter, page, page_size, keyword, status
    )
    return PaginatedProjectTree(
        items=[_to_group_tree_item(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_bidding_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ProjectDetail:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _to_detail(project)


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_bidding_project(
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    name: str = Form(...),
    participating_units: str = Form(...),
    bid_opening_at: datetime = Form(...),
    group_id: Optional[int] = Form(None),
    group_name: Optional[str] = Form(None),
    group_bid_opening_at: Optional[datetime] = Form(None),
    tender_doc: Optional[UploadFile] = File(None),
    bid_doc: Optional[UploadFile] = File(None),
) -> ProjectDetail:
    try:
        payload = ProjectCreate(
            group_id=group_id,
            group_name=group_name,
            group_bid_opening_at=group_bid_opening_at,
            name=name,
            participating_units=participating_units,
            bid_opening_at=bid_opening_at,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if payload.group_id:
        group = group_service.get_group(db, payload.group_id, current_user.owner_filter)
        if not group:
            raise HTTPException(status_code=404, detail="所选项目组不存在")
        if not tender_doc or not tender_doc.filename:
            raise HTTPException(status_code=400, detail="请上传招标文件")
        if not bid_doc or not bid_doc.filename:
            raise HTTPException(status_code=400, detail="请上传投标文件")
        for upload, attachment_type in (
            (tender_doc, AttachmentType.tender_doc),
            (bid_doc, AttachmentType.bid_doc),
        ):
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
        resolved_group_id = group.id
    else:
        if not payload.group_name:
            raise HTTPException(status_code=400, detail="请选择项目组或填写分组名称")

        group = group_service.create_group(
            db,
            owner=current_user.username,
            name=payload.group_name,
            bid_opening_at=payload.bid_opening_at,
        )
        group = group_service.get_group(db, group.id, current_user.owner_filter)
        assert group is not None

        for upload, attachment_type in (
            (tender_doc, AttachmentType.tender_doc),
            (bid_doc, AttachmentType.bid_doc),
        ):
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
        resolved_group_id = group.id

    project = service.create_project(
        db,
        group_id=resolved_group_id,
        name=payload.name,
        participating_units=payload.participating_units,
        bid_opening_at=payload.bid_opening_at,
    )
    project = service.get_project(db, project.id, current_user.owner_filter)
    assert project is not None
    log_service.record_log(
        db,
        username=current_user.username,
        action="create",
        module="bidding",
        resource_type="project",
        resource_id=project.id,
        summary=f"创建项目 {project.name}",
        ip_address=get_client_ip(request),
    )
    return _to_detail(project)


@router.patch("/{project_id}", response_model=ProjectDetail)
async def update_bidding_project(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    name: Optional[str] = Form(None),
    participating_units: Optional[str] = Form(None),
    bid_opening_at: Optional[datetime] = Form(None),
) -> ProjectDetail:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    try:
        payload = ProjectUpdate(name=name, participating_units=participating_units, bid_opening_at=bid_opening_at)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        service.update_project(
            db,
            project,
            name=payload.name,
            participating_units=payload.participating_units,
            bid_opening_at=payload.bid_opening_at,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    project = service.get_project(db, project_id, current_user.owner_filter)
    assert project is not None
    log_service.record_log(
        db,
        username=current_user.username,
        action="update",
        module="bidding",
        resource_type="project",
        resource_id=project.id,
        summary=f"更新项目 {project.name}",
        ip_address=get_client_ip(request),
    )
    return _to_detail(project)


@router.post("/{project_id}/feedback", response_model=FeedbackOut)
def submit_project_feedback(
    project_id: int,
    payload: FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FeedbackOut:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    try:
        feedback = service.submit_feedback(
            db,
            project,
            final_score=payload.final_score,
            ranking=payload.ranking,
            score_detail=payload.score_detail,
            remark=payload.remark,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_service.record_log(
        db,
        username=current_user.username,
        action="feedback",
        module="bidding",
        resource_type="project",
        resource_id=project.id,
        summary=f"提交项目 {project.name} 评审反馈",
        ip_address=get_client_ip(request),
    )
    return FeedbackOut.model_validate(feedback)


@router.delete("/{project_id}", status_code=204)
def delete_bidding_project(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    name = project.name
    service.delete_project(db, project)
    log_service.record_log(
        db,
        username=current_user.username,
        action="delete",
        module="bidding",
        resource_type="project",
        resource_id=project_id,
        summary=f"删除项目 {name}",
        ip_address=get_client_ip(request),
    )
