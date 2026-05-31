from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import AttachmentType, ProjectAttachment
from app.schemas import ThirdPartyBiddingFileInfo, ThirdPartyBidFileOut, ThirdPartyFileOut
from app.services import bidding_companies as company_service
from app.services import bidding_projects as project_service

router = APIRouter(prefix="/api/third-party", tags=["third-party"])


def _download_url(path: str) -> str:
    return f"/api/third-party{path}"


def _file_response(attachment: ProjectAttachment) -> FileResponse:
    settings = get_settings()
    file_path = settings.uploads_dir / attachment.stored_name
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File does not exist")
    return FileResponse(
        path=file_path,
        filename=attachment.original_name,
        media_type=attachment.content_type or "application/octet-stream",
    )


@router.get("/bidding-files/basic-info", response_model=Optional[ThirdPartyBiddingFileInfo])
def get_bidding_file_basic_info(
    db: Session = Depends(get_db),
) -> Optional[ThirdPartyBiddingFileInfo]:
    project = project_service.get_next_unsynced_project(db)
    if not project:
        return None

    tender_file = project_service.tender_attachments(project)[0]
    bid_files = [
        attachment
        for company in sorted(project.companies, key=lambda c: c.id)
        for attachment in company_service.sorted_bid_versions(company)
    ][:5]

    project_service.mark_third_party_synced(db, project)

    return ThirdPartyBiddingFileInfo(
        project_id=project.id,
        group_id=project.group_id,
        group_name=project.group.name,
        project_name=project.name,
        participating_units=project.participating_units,
        bid_opening_at=project.bid_opening_at,
        third_party_sync_status=project.third_party_sync_status,
        tender_file=ThirdPartyFileOut(
            id=tender_file.id,
            project_id=project.id,
            original_name=tender_file.original_name,
            size_bytes=tender_file.size_bytes,
            download_url=_download_url(f"/bidding-files/tender/{tender_file.id}/download"),
        ),
        bid_files=[
            ThirdPartyBidFileOut(
                id=attachment.id,
                project_id=project.id,
                company_id=attachment.company_id or 0,
                company_name=attachment.company.name if attachment.company else "",
                version_number=attachment.version_number or 1,
                original_name=attachment.original_name,
                size_bytes=attachment.size_bytes,
                download_url=_download_url(f"/bidding-files/bids/{attachment.id}/download"),
            )
            for attachment in bid_files
        ],
    )


@router.get("/bidding-files/tender/{attachment_id}/download")
def download_tender_file(
    attachment_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    attachment = db.scalar(
        select(ProjectAttachment).where(
            ProjectAttachment.id == attachment_id,
            ProjectAttachment.attachment_type == AttachmentType.tender_doc,
            ProjectAttachment.company_id.is_(None),
        )
    )
    if not attachment:
        raise HTTPException(status_code=404, detail="Tender file does not exist")
    return _file_response(attachment)


@router.get("/bidding-files/bids/{attachment_id}/download")
def download_bid_file(
    attachment_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    attachment = company_service.get_bid_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Bid file does not exist")
    return _file_response(attachment)
