from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import AttachmentType, BiddingProject, ProjectStatus
from app.schemas import (
    FeedbackCreate,
    FeedbackOut,
    PaginatedProjects,
    ProjectCreate,
    ProjectDetail,
    ProjectListItem,
    ProjectUpdate,
)
from app.services import bidding_projects as service
from app.services.files import save_upload

router = APIRouter(prefix="/api/bidding-projects", tags=["bidding-projects"])


def _to_list_item(project: BiddingProject) -> ProjectListItem:
    return ProjectListItem(
        id=project.id,
        name=project.name,
        participating_units=project.participating_units,
        bid_opening_at=project.bid_opening_at,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        final_score=float(project.feedback.final_score) if project.feedback else None,
        ranking=project.feedback.ranking if project.feedback else None,
        attachment_count=len(project.attachments),
    )


def _to_detail(project: BiddingProject) -> ProjectDetail:
    return ProjectDetail.model_validate(project)


@router.get("", response_model=PaginatedProjects)
def list_bidding_projects(
    page: int = 1,
    page_size: int = 10,
    keyword: Optional[str] = None,
    status: Optional[ProjectStatus] = None,
    db: Session = Depends(get_db),
) -> PaginatedProjects:
    page = max(page, 1)
    page_size = min(max(page_size, 1), 50)
    rows, total = service.list_projects(db, page, page_size, keyword, status)
    return PaginatedProjects(
        items=[_to_list_item(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{project_id}", response_model=ProjectDetail)
def get_bidding_project(project_id: int, db: Session = Depends(get_db)) -> ProjectDetail:
    project = service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    return _to_detail(project)


@router.post("", response_model=ProjectDetail, status_code=201)
async def create_bidding_project(
    name: str = Form(...),
    participating_units: str = Form(...),
    bid_opening_at: datetime = Form(...),
    tender_doc: Optional[UploadFile] = File(None),
    bid_doc: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    try:
        payload = ProjectCreate(
            name=name,
            participating_units=participating_units,
            bid_opening_at=bid_opening_at,
        )
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if not tender_doc or not tender_doc.filename:
        raise HTTPException(status_code=400, detail="请上传招标文件")
    if not bid_doc or not bid_doc.filename:
        raise HTTPException(status_code=400, detail="请上传投标文件")

    project = service.create_project(
        db,
        name=payload.name,
        participating_units=payload.participating_units,
        bid_opening_at=payload.bid_opening_at,
    )
    project = service.get_project(db, project.id)
    assert project is not None

    for upload, attachment_type in ((tender_doc, AttachmentType.tender_doc), (bid_doc, AttachmentType.bid_doc)):
        if upload and upload.filename:
            try:
                stored_name, original_name, size_bytes, content_type = await save_upload(upload, project.id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            service.replace_attachment(
                db,
                project,
                attachment_type,
                original_name=original_name,
                stored_name=stored_name,
                size_bytes=size_bytes,
                content_type=content_type,
            )
            project = service.get_project(db, project.id)
            assert project is not None

    return _to_detail(project)


@router.patch("/{project_id}", response_model=ProjectDetail)
async def update_bidding_project(
    project_id: int,
    name: Optional[str] = Form(None),
    participating_units: Optional[str] = Form(None),
    bid_opening_at: Optional[datetime] = Form(None),
    tender_doc: Optional[UploadFile] = File(None),
    bid_doc: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = service.get_project(db, project_id)
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

    project = service.get_project(db, project_id)
    assert project is not None

    for upload, attachment_type in ((tender_doc, AttachmentType.tender_doc), (bid_doc, AttachmentType.bid_doc)):
        if upload and upload.filename:
            try:
                stored_name, original_name, size_bytes, content_type = await save_upload(upload, project.id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail=str(exc)) from exc
            service.replace_attachment(
                db,
                project,
                attachment_type,
                original_name=original_name,
                stored_name=stored_name,
                size_bytes=size_bytes,
                content_type=content_type,
            )
            project = service.get_project(db, project.id)
            assert project is not None

    return _to_detail(project)


@router.post("/{project_id}/feedback", response_model=FeedbackOut)
def submit_project_feedback(
    project_id: int,
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
) -> FeedbackOut:
    project = service.get_project(db, project_id)
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
    return FeedbackOut.model_validate(feedback)


@router.get("/{project_id}/attachments/{attachment_id}/download")
def download_attachment(project_id: int, attachment_id: int, db: Session = Depends(get_db)) -> FileResponse:
    project = service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    attachment = next((a for a in project.attachments if a.id == attachment_id), None)
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


@router.delete("/{project_id}", status_code=204)
def delete_bidding_project(project_id: int, db: Session = Depends(get_db)) -> None:
    project = service.get_project(db, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")
    settings = get_settings()
    for attachment in project.attachments:
        file_path = settings.uploads_dir / attachment.stored_name
        if file_path.exists():
            file_path.unlink()
    service.delete_project(db, project)
