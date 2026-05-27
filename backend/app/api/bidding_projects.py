from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user
from app.core.security import CurrentUser
from app.core.config import get_settings
from app.db import get_db
from app.models import AttachmentType, BiddingProject, ProjectStatus
from app.schemas import (
    BidVersionListItem,
    CompanyDetail,
    CompanyListItem,
    FeedbackCreate,
    GroupTreeItem,
    PaginatedProjectTree,
    ProjectCreate,
    ProjectDetail,
    ProjectFormOptions,
    ProjectListItem,
    ProjectUpdate,
)
from app.services import bidding_companies as company_service
from app.services import bidding_project_groups as group_service
from app.services import bidding_projects as service
from app.services import operation_logs as log_service
from app.services.files import save_upload

router = APIRouter(
    prefix="/api/bidding-projects",
    tags=["bidding-projects"],
    dependencies=[Depends(get_current_user)],
)


def _to_company_item(company, project: BiddingProject) -> CompanyListItem:
    versions = company_service.sorted_bid_versions(company)
    return CompanyListItem(
        id=company.id,
        project_id=company.project_id,
        name=company.name,
        bid_opening_at=project.bid_opening_at,
        status=service.company_status(company, project),
        created_at=company.created_at,
        updated_at=company.updated_at,
        version_count=len(versions),
        final_score=float(company.feedback.final_score) if company.feedback else None,
        ranking=company.feedback.ranking if company.feedback else None,
        children=[
            BidVersionListItem(
                id=attachment.id,
                company_id=company.id,
                project_id=project.id,
                version_number=attachment.version_number or 1,
                original_name=attachment.original_name,
                size_bytes=attachment.size_bytes,
                analysis_status=attachment.analysis_status,
                created_at=attachment.created_at,
            )
            for attachment in versions
        ],
    )


def _to_project_item(project: BiddingProject) -> ProjectListItem:
    companies = sorted(project.companies, key=lambda c: c.id)
    participating = project.participating_units or "、".join(c.name for c in companies)
    return ProjectListItem(
        id=project.id,
        group_id=project.group_id,
        name=project.name,
        participating_units=participating,
        bid_opening_at=project.bid_opening_at,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        final_score=None,
        ranking=None,
        company_count=len(companies),
        attachments=service.tender_attachments(project),
        children=[_to_company_item(company, project) for company in companies],
    )


def _count_group_attachments(group) -> int:
    total = 0
    for project in group.projects:
        total += len(service.tender_attachments(project))
        for company in project.companies:
            total += len(company.attachments)
    return total


def _to_group_tree_item(group) -> GroupTreeItem:
    children = sorted(group.projects, key=lambda p: p.id, reverse=True)
    return GroupTreeItem(
        id=group.id,
        name=group.name,
        bid_opening_at=group.bid_opening_at,
        created_at=group.created_at,
        updated_at=group.updated_at,
        attachment_count=_count_group_attachments(group),
        children=[_to_project_item(child) for child in children],
    )


def _to_detail(project: BiddingProject) -> ProjectDetail:
    companies = sorted(project.companies, key=lambda c: c.id)
    participating = project.participating_units or "、".join(c.name for c in companies)
    return ProjectDetail(
        id=project.id,
        group_id=project.group_id,
        group_name=project.group.name,
        name=project.name,
        participating_units=participating,
        bid_opening_at=project.bid_opening_at,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        attachments=service.tender_attachments(project),
        companies=[
            CompanyDetail(
                id=company.id,
                project_id=company.project_id,
                name=company.name,
                created_at=company.created_at,
                updated_at=company.updated_at,
                attachments=company_service.sorted_bid_versions(company),
                feedback=company.feedback,
            )
            for company in companies
        ],
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


@router.get("/form-options", response_model=ProjectFormOptions)
def get_project_form_options(
    group_id: Optional[int] = Query(default=None, ge=1),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ProjectFormOptions:
    if group_id is not None:
        group = group_service.get_group(db, group_id, current_user.owner_filter)
        if not group:
            raise HTTPException(status_code=404, detail="项目组不存在")

    project_names, company_names = service.list_form_options(
        db,
        current_user.owner_filter,
        group_id=group_id,
    )
    return ProjectFormOptions(project_names=project_names, company_names=company_names)


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
    bid_opening_at: Optional[datetime] = Form(None),
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

    if not bid_doc or not bid_doc.filename:
        raise HTTPException(status_code=400, detail="请上传投标文件")

    is_new_group = payload.group_id is None

    if payload.group_id:
        group = group_service.get_group(db, payload.group_id, current_user.owner_filter)
        if not group:
            raise HTTPException(status_code=404, detail="所选项目组不存在")
        resolved_group_id = group.id
        resolved_bid_opening_at = group.bid_opening_at
    else:
        if not payload.group_name:
            raise HTTPException(status_code=400, detail="请选择项目组或填写分组名称")
        opening_at = payload.group_bid_opening_at or payload.bid_opening_at
        if not opening_at:
            raise HTTPException(status_code=400, detail="请选择开标时间")
        group = group_service.create_group(
            db,
            owner=current_user.username,
            name=payload.group_name,
            bid_opening_at=opening_at,
        )
        group = group_service.get_group(db, group.id, current_user.owner_filter)
        assert group is not None
        resolved_group_id = group.id
        resolved_bid_opening_at = group.bid_opening_at

    existing_project = service.find_project_by_group_and_name(
        db,
        resolved_group_id,
        payload.name,
        current_user.owner_filter,
    )

    if is_new_group and (not tender_doc or not tender_doc.filename):
        raise HTTPException(status_code=400, detail="请上传招标文件")

    if existing_project is None:
        project = service.create_project(
            db,
            group_id=resolved_group_id,
            name=payload.name,
            participating_units="",
            bid_opening_at=resolved_bid_opening_at,
        )
    else:
        project = existing_project

    if tender_doc and tender_doc.filename:
        try:
            stored_name, original_name, size_bytes, content_type = await save_upload(
                tender_doc, project.id, prefix="project"
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        service.replace_project_attachment(
            db,
            project,
            AttachmentType.tender_doc,
            original_name=original_name,
            stored_name=stored_name,
            size_bytes=size_bytes,
            content_type=content_type,
        )

    try:
        stored_name, original_name, size_bytes, content_type = await save_upload(
            bid_doc, project.id, prefix="company"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    company = company_service.get_or_create_company(db, project, name=payload.participating_units)
    company_service.add_bid_version(
        db,
        company,
        original_name=original_name,
        stored_name=stored_name,
        size_bytes=size_bytes,
        content_type=content_type,
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
        summary=f"登记项目 {project.name} / {payload.participating_units.strip()} 投标文件",
        ip_address=get_client_ip(request),
    )
    return _to_detail(project)


@router.get(
    "/{project_id}/attachments/{attachment_id}/download",
)
def download_project_attachment(
    project_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    attachment = next(
        (a for a in service.tender_attachments(project) if a.id == attachment_id),
        None,
    )
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


@router.patch("/{project_id}", response_model=ProjectDetail)
async def update_bidding_project(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    name: Optional[str] = Form(None),
    participating_units: Optional[str] = Form(None),
) -> ProjectDetail:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    try:
        payload = ProjectUpdate(name=name, participating_units=participating_units)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    try:
        service.update_project(
            db,
            project,
            name=payload.name,
            participating_units=payload.participating_units,
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
