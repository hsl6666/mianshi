from datetime import datetime
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    get_client_ip,
    get_current_user,
    require_permission,
)
from app.core.security import CurrentUser
from app.core.config import get_settings
from app.db import get_db
from app.models import AttachmentType, BiddingProject, ProjectStatus
from app.schemas import (
    BidVersionListItem,
    CompanyDetail,
    CompanyListItem,
    GroupTreeItem,
    PaginatedProjectTree,
    ProjectCreate,
    ProjectDetail,
    ProjectFormOptions,
    ProjectListItem,
    ProjectThirdPartySyncStatusUpdate,
    ProjectUpdate,
)
from app.services import bidding_companies as company_service
from app.services import bidding_project_groups as group_service
from app.services import bidding_projects as service
from app.services import operation_logs as log_service
from app.services.bidding_serializers import attachment_to_out, project_group_context
from app.services.feishu_notifications import BidUploadNotification, notify_bid_upload
from app.services.files import is_likely_report_file, save_upload
from app.services.third_party_sync_events import broadcast_bid_upload

router = APIRouter(
    prefix="/api/bidding-projects",
    tags=["bidding-projects"],
    dependencies=[Depends(require_permission("bidding", "view"))],
)


def _to_company_item(company, project: BiddingProject) -> CompanyListItem:
    versions = company_service.sorted_bid_versions(company)
    return CompanyListItem(
        id=company.id,
        project_id=company.project_id,
        name=company.name,
        bid_opening_time=project.bid_opening_at,
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
                third_party_file_name=attachment.third_party_file_name or attachment.original_name,
                size_bytes=attachment.size_bytes,
                analysis_status=attachment.analysis_status,
                report_status=attachment.report_status,
                third_party_sync_status=attachment.third_party_sync_status,
                third_party_submission_file_id=attachment.third_party_submission_file_id,
                report_original_name=attachment.report_original_name,
                report_size_bytes=attachment.report_size_bytes,
                report_uploaded_at=attachment.report_uploaded_at,
                report_has_data=attachment.report_has_data,
                report_title=attachment.report_title,
                report_final_score=attachment.report_final_score,
                report_project_amount=attachment.report_project_amount,
                report_rating=attachment.report_rating,
                report_feedback=attachment.report_feedback,
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
        db_id=project.group_id,
        name=project.name,
        participating_units=participating,
        bid_opening_time=project.bid_opening_at,
        status=project.status,
        third_party_sync_status=project.third_party_sync_status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        final_score=None,
        ranking=None,
        company_count=len(companies),
        attachments=[attachment_to_out(item) for item in service.tender_attachments(project)],
        children=[_to_company_item(company, project) for company in companies],
    )


def _count_group_attachments(group) -> int:
    total = len(group.attachments)
    for project in group.projects:
        total += len(service.tender_attachments(project))
        for company in project.companies:
            total += len(company.attachments)
    return total


def _to_group_tree_item(group) -> GroupTreeItem:
    children = sorted(group.projects, key=lambda p: p.id, reverse=True)
    return GroupTreeItem(
        db_id=group.id,
        project_name=group.name,
        bid_opening_time=group.bid_opening_at,
        project_id=group.third_party_project_id,
        project_code=group.project_code,
        evaluation_date=group.evaluation_date,
        created_at=group.created_at,
        updated_at=group.updated_at,
        attachment_count=_count_group_attachments(group),
        attachments=[attachment_to_out(item) for item in group.attachments],
        children=[_to_project_item(child) for child in children],
    )


def _to_detail(project: BiddingProject) -> ProjectDetail:
    companies = sorted(project.companies, key=lambda c: c.id)
    participating = project.participating_units or "、".join(c.name for c in companies)
    group_ctx = project_group_context(project)
    return ProjectDetail(
        id=project.id,
        name=project.name,
        participating_units=participating,
        status=project.status,
        third_party_sync_status=project.third_party_sync_status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        attachments=[attachment_to_out(item) for item in service.tender_attachments(project)],
        companies=[
            CompanyDetail(
                id=company.id,
                project_id=company.project_id,
                name=company.name,
                created_at=company.created_at,
                updated_at=company.updated_at,
                attachments=[
                    attachment_to_out(item) for item in company_service.sorted_bid_versions(company)
                ],
                feedback=company.feedback,
            )
            for company in companies
        ],
        **group_ctx,
    )


@router.get("", response_model=PaginatedProjectTree)
def list_bidding_projects(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    status: Optional[ProjectStatus] = None,
    owner: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> PaginatedProjectTree:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    owner_filter = current_user.owner_filter
    if current_user.is_super_admin:
        owner_filter = owner.strip() if owner and owner.strip() else None
    rows, total = service.list_project_tree(
        db, owner_filter, page, page_size, keyword, status
    )
    return PaginatedProjectTree(
        items=[_to_group_tree_item(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/form-options", response_model=ProjectFormOptions)
def get_project_form_options(
    db_id: Optional[int] = Query(default=None, ge=1, alias="db_id"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> ProjectFormOptions:
    if db_id is not None:
        group = group_service.get_group(db, db_id, current_user.owner_filter)
        if not group:
            raise HTTPException(status_code=404, detail="项目组不存在")

    project_names, company_names = service.list_form_options(
        db,
        current_user.owner_filter,
        group_id=db_id,
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


@router.post("", response_model=ProjectDetail, status_code=201, dependencies=[Depends(require_permission("bidding", "create"))])
async def create_bidding_project(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    participating_units: str = Form(...),
    name: Optional[str] = Form(None),
    db_id: Optional[int] = Form(None),
    project_name: Optional[str] = Form(None),
    bid_opening_time: Optional[datetime] = Form(None),
    project_id: Optional[str] = Form(None),
    third_party_file_name: Optional[str] = Form(None),
    evaluation_date: Optional[datetime] = Form(None),
    tender_doc: Optional[UploadFile] = File(None),
    bid_file: Optional[UploadFile] = File(None),
) -> ProjectDetail:
    try:
        payload = ProjectCreate(
            db_id=db_id,
            project_name=project_name,
            bid_opening_time=bid_opening_time,
            project_id=project_id,
            third_party_file_name=third_party_file_name,
            evaluation_date=evaluation_date,
            name=name,
            participating_units=participating_units,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not bid_file or not bid_file.filename:
        raise HTTPException(status_code=400, detail="请上传投标文件")
    if is_likely_report_file(bid_file.filename):
        raise HTTPException(status_code=400, detail="检测到报告文件，请在投标文件行使用“上传报告”")

    is_new_group = payload.db_id is None

    if payload.db_id:
        group = group_service.get_group(db, payload.db_id, current_user.owner_filter)
        if not group:
            raise HTTPException(status_code=404, detail="所选项目组不存在")
        resolved_group_id = group.id
        resolved_bid_opening_at = group.bid_opening_at
    else:
        if not payload.project_name:
            raise HTTPException(status_code=400, detail="请选择项目组或填写项目名称")
        if not payload.bid_opening_time:
            raise HTTPException(status_code=400, detail="请选择开标时间")
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
        resolved_group_id = group.id
        resolved_bid_opening_at = group.bid_opening_at

    if is_new_group and (not tender_doc or not tender_doc.filename):
        raise HTTPException(status_code=400, detail="请上传招标文件")

    try:
        project = service.get_or_create_project_for_group(
            db,
            group,
            payload.name,
            current_user.owner_filter,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

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
            bid_file, project.id, prefix="company"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    company = company_service.get_or_create_company(db, project, name=payload.participating_units)
    attachment = company_service.add_bid_version(
        db,
        company,
        original_name=original_name,
        stored_name=stored_name,
        size_bytes=size_bytes,
        content_type=content_type,
        third_party_file_name=payload.third_party_file_name or original_name,
    )
    await broadcast_bid_upload(db, attachment.id)
    background_tasks.add_task(
        notify_bid_upload,
        BidUploadNotification(
            group_name=group.name,
            project_name=project.name,
            company_name=company.name,
            original_name=attachment.original_name,
            version_number=attachment.version_number or 1,
            size_bytes=attachment.size_bytes,
            uploaded_by=current_user.username,
            uploaded_at=attachment.created_at,
        ),
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
    dependencies=[Depends(require_permission("bidding", "download"))],
)
def download_project_attachment(
    project_id: int,
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "download")),
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


@router.patch("/{project_id}", response_model=ProjectDetail, dependencies=[Depends(require_permission("bidding", "edit"))])
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


@router.patch("/{project_id}/third-party-sync-status", response_model=ProjectThirdPartySyncStatusUpdate)
def update_project_third_party_sync_status(
    project_id: int,
    payload: ProjectThirdPartySyncStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "sync")),
) -> ProjectThirdPartySyncStatusUpdate:
    project = service.get_project(db, project_id, current_user.owner_filter)
    if not project:
        raise HTTPException(status_code=404, detail="Project does not exist")

    service.update_third_party_sync_status(
        db,
        project,
        third_party_sync_status=payload.third_party_sync_status,
    )
    status_label = payload.third_party_sync_status.value
    log_service.record_log(
        db,
        username=current_user.username,
        action="update",
        module="bidding",
        resource_type="project",
        resource_id=project.id,
        summary=f"Update project {project.name} third-party sync status -> {status_label}",
        ip_address=get_client_ip(request),
    )
    return payload


@router.delete("/{project_id}", status_code=204, dependencies=[Depends(require_permission("bidding", "delete"))])
def delete_bidding_project(
    project_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "delete")),
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
