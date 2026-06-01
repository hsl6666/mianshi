from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_client_ip, get_current_user, require_super_admin
from app.core.config import get_settings
from app.core.security import CurrentUser
from app.db import get_db
from app.schemas import (
    AttachmentOut,
    BidVersionAnalysisUpdate,
    BidVersionThirdPartySyncStatusUpdate,
    CompanyDetail,
    CompanyUpdate,
    FeedbackCreate,
    FeedbackOut,
)
from app.services import bidding_companies as company_service
from app.services import operation_logs as log_service
from app.services.files import save_upload

router = APIRouter(
    prefix="/api",
    tags=["bidding-companies"],
    dependencies=[Depends(get_current_user)],
)


def _to_company_detail(company) -> CompanyDetail:
    return CompanyDetail(
        id=company.id,
        project_id=company.project_id,
        name=company.name,
        created_at=company.created_at,
        updated_at=company.updated_at,
        attachments=company_service.sorted_bid_versions(company),
        feedback=company.feedback,
    )


@router.get("/bidding-companies/{company_id}", response_model=CompanyDetail)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> CompanyDetail:
    company = company_service.get_company(db, company_id, current_user.owner_filter)
    if not company:
        raise HTTPException(status_code=404, detail="投标单位不存在")
    return _to_company_detail(company)


@router.post("/bidding-companies/{company_id}/feedback", response_model=FeedbackOut)
def submit_company_feedback(
    company_id: int,
    payload: FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FeedbackOut:
    company = company_service.get_company(db, company_id, current_user.owner_filter)
    if not company:
        raise HTTPException(status_code=404, detail="投标单位不存在")
    try:
        feedback = company_service.submit_feedback(
            db,
            company,
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
        resource_type="company",
        resource_id=company.id,
        summary=f"提交投标单位 {company.name} 评审反馈",
        ip_address=get_client_ip(request),
    )
    return FeedbackOut.model_validate(feedback)


@router.patch("/bidding-companies/{company_id}", response_model=CompanyDetail)
def update_company(
    company_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
    name: Optional[str] = Form(None),
) -> CompanyDetail:
    company = company_service.get_company(db, company_id, current_user.owner_filter)
    if not company:
        raise HTTPException(status_code=404, detail="投标单位不存在")
    try:
        payload = CompanyUpdate(name=name)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if payload.name:
        company_service.update_company(db, company, name=payload.name)

    company = company_service.get_company(db, company_id, current_user.owner_filter)
    assert company is not None
    log_service.record_log(
        db,
        username=current_user.username,
        action="update",
        module="bidding",
        resource_type="company",
        resource_id=company.id,
        summary=f"更新投标单位 {company.name}",
        ip_address=get_client_ip(request),
    )
    return _to_company_detail(company)


@router.delete("/bidding-companies/{company_id}", status_code=204)
def delete_company(
    company_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    company = company_service.get_company(db, company_id, current_user.owner_filter)
    if not company:
        raise HTTPException(status_code=404, detail="投标单位不存在")
    name = company.name
    company_service.delete_company(db, company)
    log_service.record_log(
        db,
        username=current_user.username,
        action="delete",
        module="bidding",
        resource_type="company",
        resource_id=company_id,
        summary=f"删除投标单位 {name}",
        ip_address=get_client_ip(request),
    )


@router.patch("/bid-versions/{attachment_id}/analysis-status", response_model=BidVersionAnalysisUpdate)
def update_bid_version_analysis_status(
    attachment_id: int,
    payload: BidVersionAnalysisUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_super_admin),
) -> BidVersionAnalysisUpdate:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")

    company_service.update_bid_analysis_status(
        db,
        attachment,
        analysis_status=payload.analysis_status,
    )
    status_label = "是" if payload.analysis_status else "否"
    company_name = attachment.company.name if attachment.company else ""
    log_service.record_log(
        db,
        username=current_user.username,
        action="update",
        module="bidding",
        resource_type="bid_version",
        resource_id=attachment_id,
        summary=f"更新投标文件分析状态 {company_name} v{attachment.version_number or '-'} -> {status_label}",
        ip_address=get_client_ip(request),
    )
    return payload


@router.patch("/bid-versions/{attachment_id}/third-party-sync-status", response_model=BidVersionThirdPartySyncStatusUpdate)
def update_bid_version_third_party_sync_status(
    attachment_id: int,
    payload: BidVersionThirdPartySyncStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_super_admin),
) -> BidVersionThirdPartySyncStatusUpdate:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")

    company_service.update_bid_third_party_sync_status(
        db,
        attachment,
        third_party_sync_status=payload.third_party_sync_status,
    )
    status_label = payload.third_party_sync_status.value
    company_name = attachment.company.name if attachment.company else ""
    log_service.record_log(
        db,
        username=current_user.username,
        action="update",
        module="bidding",
        resource_type="bid_version",
        resource_id=attachment_id,
        summary=f"更新投标文件三方同步状态 {company_name} v{attachment.version_number or '-'} -> {status_label}",
        ip_address=get_client_ip(request),
    )
    return payload


@router.post("/bid-versions/{attachment_id}/report", response_model=AttachmentOut)
async def upload_bid_version_report(
    attachment_id: int,
    request: Request,
    report_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_super_admin),
) -> AttachmentOut:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")

    try:
        stored_name, original_name, size_bytes, content_type = await save_upload(
            report_file, attachment_id, prefix="report"
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    attachment = company_service.replace_bid_report(
        db,
        attachment,
        original_name=original_name,
        stored_name=stored_name,
        size_bytes=size_bytes,
        content_type=content_type,
    )
    company_name = attachment.company.name if attachment.company else ""
    log_service.record_log(
        db,
        username=current_user.username,
        action="upload",
        module="bidding",
        resource_type="bid_version_report",
        resource_id=attachment_id,
        summary=f"上传投标文件报告 {company_name} v{attachment.version_number or '-'}",
        ip_address=get_client_ip(request),
    )
    return AttachmentOut.model_validate(attachment)


@router.get("/bid-versions/{attachment_id}/report/download")
def download_bid_version_report(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    if not attachment.report_stored_name or not attachment.report_original_name:
        raise HTTPException(status_code=404, detail="报告不存在")

    settings = get_settings()
    file_path = settings.uploads_dir / attachment.report_stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=file_path,
        filename=attachment.report_original_name,
        media_type=attachment.report_content_type or "application/octet-stream",
    )


@router.delete("/bid-versions/{attachment_id}", status_code=204)
def delete_bid_version(
    attachment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> None:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    company_name = attachment.company.name if attachment.company else ""
    company_service.delete_bid_version(db, attachment)
    log_service.record_log(
        db,
        username=current_user.username,
        action="delete",
        module="bidding",
        resource_type="bid_version",
        resource_id=attachment_id,
        summary=f"删除投标文件版本 {company_name} v{attachment.version_number or '-'}",
        ip_address=get_client_ip(request),
    )


@router.get("/bid-versions/{attachment_id}/preview")
def preview_bid_version(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")

    settings = get_settings()
    file_path = settings.uploads_dir / attachment.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    media_type = attachment.content_type or "application/octet-stream"
    if media_type == "application/octet-stream" and attachment.original_name.lower().endswith(".pdf"):
        media_type = "application/pdf"

    return FileResponse(
        path=file_path,
        media_type=media_type,
        filename=attachment.original_name,
        content_disposition_type="inline",
    )


@router.get("/bid-versions/{attachment_id}/download")
def download_bid_version(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
) -> FileResponse:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")

    settings = get_settings()
    file_path = settings.uploads_dir / attachment.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")

    return FileResponse(
        path=file_path,
        filename=attachment.original_name,
        media_type=attachment.content_type or "application/octet-stream",
    )
