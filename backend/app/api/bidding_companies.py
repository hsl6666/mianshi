from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import (
    get_client_ip,
    get_current_user,
    require_permission,
    require_report_data_upload_auth,
)
from app.core.config import get_settings
from app.core.security import CurrentUser
from app.db import get_db
from app.models import ProjectAttachment
from app.services.bidding_serializers import attachment_to_out
from app.schemas import (
    AttachmentOut,
    BidVersionAnalysisUpdate,
    BidVersionIssueFeedbackUpdate,
    BidVersionReportFeedbackUpdate,
    BidVersionThirdPartySubmissionBind,
    BidVersionThirdPartySyncStatusUpdate,
    CompanyDetail,
    CompanyUpdate,
    FeedbackCreate,
    FeedbackOut,
    TechnicalReviewReportData,
    TechnicalReviewReportOut,
)
from app.services import bidding_companies as company_service
from app.services import operation_logs as log_service
from app.services.files import save_upload

router = APIRouter(
    prefix="/api",
    tags=["bidding-companies"],
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


@router.get("/bidding-companies/{company_id}", response_model=CompanyDetail, dependencies=[Depends(require_permission("bidding", "view"))])
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "view")),
) -> CompanyDetail:
    company = company_service.get_company(db, company_id, current_user.owner_filter)
    if not company:
        raise HTTPException(status_code=404, detail="投标单位不存在")
    return _to_company_detail(company)


@router.post("/bidding-companies/{company_id}/feedback", response_model=FeedbackOut, dependencies=[Depends(require_permission("bidding", "feedback"))])
def submit_company_feedback(
    company_id: int,
    payload: FeedbackCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "feedback")),
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


@router.patch("/bidding-companies/{company_id}", response_model=CompanyDetail, dependencies=[Depends(require_permission("bidding", "edit"))])
def update_company(
    company_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "edit")),
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


@router.delete("/bidding-companies/{company_id}", status_code=204, dependencies=[Depends(require_permission("bidding", "delete"))])
def delete_company(
    company_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "delete")),
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


@router.patch("/bid-versions/{attachment_id}/third-party-submission", response_model=AttachmentOut)
def bind_bid_version_third_party_submission(
    attachment_id: int,
    payload: BidVersionThirdPartySubmissionBind,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "create")),
) -> AttachmentOut:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")

    try:
        attachment = company_service.bind_third_party_submission(
            db,
            attachment,
            submission_file_id=payload.submission_file_id,
            status=payload.status,
            report=payload.report,
            report_data=payload.report_data,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    company_name = attachment.company.name if attachment.company else ""
    log_service.record_log(
        db,
        username=current_user.username,
        action="bind",
        module="bidding",
        resource_type="bid_version_third_party_submission",
        resource_id=attachment_id,
        summary=f"绑定三方投标文件 {company_name} v{attachment.version_number or '-'}",
        detail={"submission_file_id": attachment.third_party_submission_file_id},
        ip_address=get_client_ip(request),
    )
    return attachment_to_out(attachment)


@router.patch("/bid-versions/{attachment_id}/analysis-status", response_model=BidVersionAnalysisUpdate)
def update_bid_version_analysis_status(
    attachment_id: int,
    payload: BidVersionAnalysisUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "analysis")),
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
    current_user: CurrentUser = Depends(require_permission("bidding", "sync")),
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
    current_user: CurrentUser = Depends(require_permission("bidding", "report_upload")),
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


def _resolve_attachment_for_report_data_upload(
    db: Session,
    payload: dict,
    *,
    attachment_id: int | None = None,
) -> tuple[ProjectAttachment, dict]:
    submission_file_id = company_service.extract_submission_file_id(payload)
    if submission_file_id:
        attachment = company_service.get_bid_attachment_by_submission_file_id(db, submission_file_id)
        if not attachment:
            raise HTTPException(
                status_code=404,
                detail=f"未找到 submission_file_id={submission_file_id} 对应的投标文件版本",
            )
        if attachment_id is not None and attachment.id != attachment_id:
            raise HTTPException(status_code=400, detail="submission_file_id 与路径中的版本 ID 不一致")
    elif attachment_id is not None:
        attachment = company_service.get_bid_attachment(db, attachment_id)
        if not attachment:
            raise HTTPException(status_code=404, detail="投标文件版本不存在")
    else:
        raise HTTPException(status_code=400, detail="缺少 submission_file_id，无法关联投标文件版本")

    report_payload = payload.get("report") if isinstance(payload.get("report"), dict) else payload
    if not isinstance(report_payload, dict):
        raise HTTPException(status_code=400, detail="报告数据格式错误")
    return attachment, report_payload


@router.post("/bid-versions/report-data", response_model=AttachmentOut)
def upload_bid_version_report_data_by_submission_file(
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
) -> AttachmentOut:
    attachment, report_payload = _resolve_attachment_for_report_data_upload(db, payload)
    attachment = company_service.replace_bid_report_data(
        db,
        attachment,
        report_data=report_payload,
    )
    company_name = attachment.company.name if attachment.company else ""
    log_service.record_log(
        db,
        username="report_api",
        action="upload",
        module="bidding",
        resource_type="bid_version_report_data",
        resource_id=attachment.id,
        summary=f"上传投标文件结构化报告 {company_name} v{attachment.version_number or '-'}",
        detail={"submission_file_id": attachment.third_party_submission_file_id},
        ip_address=get_client_ip(request),
    )
    return attachment_to_out(attachment)


@router.post("/bid-versions/{attachment_id}/report-data", response_model=AttachmentOut)
def upload_bid_version_report_data(
    attachment_id: int,
    payload: dict,
    request: Request,
    db: Session = Depends(get_db),
    api_username: str = Depends(require_report_data_upload_auth),
) -> AttachmentOut:
    attachment, report_payload = _resolve_attachment_for_report_data_upload(
        db,
        payload,
        attachment_id=attachment_id,
    )
    attachment = company_service.replace_bid_report_data(
        db,
        attachment,
        report_data=report_payload,
    )
    company_name = attachment.company.name if attachment.company else ""
    log_service.record_log(
        db,
        username=api_username,
        action="upload",
        module="bidding",
        resource_type="bid_version_report_data",
        resource_id=attachment.id,
        summary=f"上传投标文件结构化报告 {company_name} v{attachment.version_number or '-'}",
        detail={"submission_file_id": attachment.third_party_submission_file_id},
        ip_address=get_client_ip(request),
    )
    return attachment_to_out(attachment)


@router.get("/public/bid-versions/{attachment_id}/report-data", response_model=TechnicalReviewReportOut)
def get_public_bid_version_report_data(
    attachment_id: int,
    db: Session = Depends(get_db),
) -> TechnicalReviewReportOut:
    attachment = company_service.get_bid_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    report_data = company_service.get_bid_report_data(attachment)
    if report_data is None or attachment.report_uploaded_at is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    return company_service.build_technical_review_report_out(db, attachment, report_data)


@router.patch("/public/bid-versions/{attachment_id}/report-feedback", response_model=TechnicalReviewReportOut)
def update_public_bid_version_report_feedback(
    attachment_id: int,
    payload: BidVersionReportFeedbackUpdate,
    db: Session = Depends(get_db),
) -> TechnicalReviewReportOut:
    attachment = company_service.get_bid_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    if attachment.report_uploaded_at is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    report_data = company_service.update_bid_report_feedback(
        db,
        attachment,
        feedback=payload.feedback,
    )
    if report_data is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    return company_service.build_technical_review_report_out(db, attachment, report_data)


@router.patch(
    "/public/bid-versions/{attachment_id}/report-data/issues/{issue_id}/feedback",
    response_model=TechnicalReviewReportOut,
)
def update_public_bid_version_report_issue_feedback(
    attachment_id: int,
    issue_id: str,
    payload: BidVersionIssueFeedbackUpdate,
    db: Session = Depends(get_db),
) -> TechnicalReviewReportOut:
    attachment = company_service.get_bid_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    if attachment.report_uploaded_at is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    report_data = company_service.update_bid_report_issue_feedback(
        db,
        attachment,
        issue_id=issue_id,
        feedback=payload.feedback,
        comment=payload.comment,
    )
    if report_data is None:
        raise HTTPException(status_code=404, detail="报告问题不存在")

    return company_service.build_technical_review_report_out(db, attachment, report_data)


@router.get("/bid-versions/{attachment_id}/report-data", response_model=TechnicalReviewReportOut, dependencies=[Depends(require_permission("bidding", "report_view"))])
def get_bid_version_report_data(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "report_view")),
) -> TechnicalReviewReportOut:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    report_data = company_service.get_bid_report_data(attachment)
    if report_data is None or attachment.report_uploaded_at is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    return company_service.build_technical_review_report_out(db, attachment, report_data)


@router.patch("/bid-versions/{attachment_id}/report-feedback", response_model=TechnicalReviewReportOut, dependencies=[Depends(require_permission("bidding", "report_view"))])
def update_bid_version_report_feedback(
    attachment_id: int,
    payload: BidVersionReportFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "report_view")),
) -> TechnicalReviewReportOut:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    if attachment.report_uploaded_at is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    report_data = company_service.update_bid_report_feedback(
        db,
        attachment,
        feedback=payload.feedback,
    )
    if report_data is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    return company_service.build_technical_review_report_out(db, attachment, report_data)


@router.patch("/bid-versions/{attachment_id}/report-data/issues/{issue_id}/feedback", response_model=TechnicalReviewReportOut, dependencies=[Depends(require_permission("bidding", "report_view"))])
def update_bid_version_report_issue_feedback(
    attachment_id: int,
    issue_id: str,
    payload: BidVersionIssueFeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "report_view")),
) -> TechnicalReviewReportOut:
    attachment = company_service.get_bid_attachment(db, attachment_id, current_user.owner_filter)
    if not attachment:
        raise HTTPException(status_code=404, detail="投标文件版本不存在")
    if attachment.report_uploaded_at is None:
        raise HTTPException(status_code=404, detail="报告数据不存在")

    report_data = company_service.update_bid_report_issue_feedback(
        db,
        attachment,
        issue_id=issue_id,
        feedback=payload.feedback,
        comment=payload.comment,
    )
    if report_data is None:
        raise HTTPException(status_code=404, detail="报告问题不存在")

    return company_service.build_technical_review_report_out(db, attachment, report_data)


@router.get("/bid-versions/{attachment_id}/report/download", dependencies=[Depends(require_permission("bidding", "report_download"))])
def download_bid_version_report(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "report_download")),
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


@router.delete("/bid-versions/{attachment_id}", status_code=204, dependencies=[Depends(require_permission("bidding", "delete"))])
def delete_bid_version(
    attachment_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "delete")),
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


@router.get("/bid-versions/{attachment_id}/preview", dependencies=[Depends(require_permission("bidding", "preview"))])
def preview_bid_version(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "preview")),
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


@router.get("/bid-versions/{attachment_id}/download", dependencies=[Depends(require_permission("bidding", "download"))])
def download_bid_version(
    attachment_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_permission("bidding", "download")),
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
