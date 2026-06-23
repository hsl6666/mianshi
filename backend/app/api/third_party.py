from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import SessionLocal, get_db
from app.models import AttachmentType, GroupAttachment, ProjectAttachment, ThirdPartySyncStatus
from app.schemas import (
    ThirdPartyBiddingFileInfo,
    ThirdPartyBidFileOut,
    ThirdPartyBidSyncAckIn,
    ThirdPartyBidSyncAckOut,
    ThirdPartyFileOut,
)
from app.services import bidding_companies as company_service
from app.services import bidding_projects as project_service
from app.services.third_party_sync_events import third_party_sync_hub

router = APIRouter(prefix="/api/third-party", tags=["third-party"])


def _download_url(path: str) -> str:
    return f"/api/third-party{path}"


def _file_response(attachment: ProjectAttachment | GroupAttachment) -> FileResponse:
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
    return _get_bidding_file_basic_info(db, bid_file_limit=5)


def _get_bidding_file_basic_info(
    db: Session,
    *,
    bid_file_limit: int,
) -> Optional[ThirdPartyBiddingFileInfo]:
    project = project_service.get_next_unsynced_project(db)
    if not project:
        return None

    tender_file = next(
        attachment
        for attachment in project_service.tender_attachments(project)
        if project_service.attachment_file_exists(attachment)
    )
    if isinstance(tender_file, GroupAttachment):
        tender_download_url = _download_url(
            f"/bidding-files/group-tender/{tender_file.id}/download"
        )
    else:
        tender_download_url = _download_url(
            f"/bidding-files/tender/{tender_file.id}/download"
        )
    bid_files = [
        attachment
        for company in sorted(project.companies, key=lambda c: c.id)
        for attachment in company_service.sorted_bid_versions(company)
        if attachment.third_party_sync_status == ThirdPartySyncStatus.unsynced
        and project_service.attachment_file_exists(attachment)
    ][:bid_file_limit]

    group = project.group
    return ThirdPartyBiddingFileInfo(
        project_id=project.id,
        db_id=project.group_id,
        group_name=group.name,
        project_name=project.name,
        participating_units=project.participating_units,
        bid_opening_time=project.bid_opening_at,
        project_code=group.project_code,
        third_party_project_id=group.third_party_project_id,
        third_party_sync_status=project.third_party_sync_status,
        tender_file=ThirdPartyFileOut(
            id=tender_file.id,
            project_id=project.id,
            original_name=tender_file.original_name,
            size_bytes=tender_file.size_bytes,
            download_url=tender_download_url,
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
                third_party_sync_status=attachment.third_party_sync_status,
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


@router.get("/bidding-files/group-tender/{attachment_id}/download")
def download_group_tender_file(
    attachment_id: int,
    db: Session = Depends(get_db),
) -> FileResponse:
    attachment = db.scalar(
        select(GroupAttachment).where(
            GroupAttachment.id == attachment_id,
            GroupAttachment.attachment_type == AttachmentType.tender_doc,
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


@router.post(
    "/bidding-files/bids/{attachment_id}/ack",
    response_model=ThirdPartyBidSyncAckOut,
)
def ack_bid_file_sync(
    attachment_id: int,
    payload: ThirdPartyBidSyncAckIn,
    db: Session = Depends(get_db),
) -> ThirdPartyBidSyncAckOut:
    return _ack_bid_file_sync(db, attachment_id=attachment_id, payload=payload)


def _ack_bid_file_sync(
    db: Session,
    *,
    attachment_id: int,
    payload: ThirdPartyBidSyncAckIn,
) -> ThirdPartyBidSyncAckOut:
    attachment = company_service.get_bid_attachment(db, attachment_id)
    if not attachment:
        raise HTTPException(status_code=404, detail="Bid file does not exist")

    updated = company_service.ack_bid_third_party_sync(
        db,
        attachment,
        metadata=payload.model_dump(),
    )
    return ThirdPartyBidSyncAckOut(
        id=updated.id,
        project_id=updated.project_id,
        company_id=updated.company_id or 0,
        third_party_sync_status=updated.third_party_sync_status,
        third_party_sync_metadata=updated.third_party_sync_metadata,
    )


@router.websocket("/bidding-files/socket")
async def bidding_files_socket(websocket: WebSocket) -> None:
    await third_party_sync_hub.connect(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type") if isinstance(message, dict) else None
            message_payload = message.get("payload") if isinstance(message, dict) else None
            if message_type == "ping":
                await websocket.send_json({"type": "pong", "payload": None})
                continue
            if message_type != "ack" or not isinstance(message_payload, dict):
                await websocket.send_json(
                    {"type": "error", "payload": {"message": "ack message is required"}}
                )
                continue

            source_bid_file_id = message_payload.get("source_bid_file_id")
            external_record_id = str(message_payload.get("external_record_id") or "")
            if not source_bid_file_id and external_record_id.startswith("mianshi:bid-file:"):
                source_bid_file_id = external_record_id.rsplit(":", 1)[-1]
            try:
                attachment_id = int(source_bid_file_id)
            except (TypeError, ValueError):
                await websocket.send_json(
                    {"type": "error", "payload": {"message": "source bid file id is required"}}
                )
                continue

            with SessionLocal() as db:
                ack = _ack_bid_file_sync(
                    db,
                    attachment_id=attachment_id,
                    payload=ThirdPartyBidSyncAckIn(**message_payload),
                )
            await websocket.send_json(
                {"type": "ack_ok", "payload": ack.model_dump(mode="json")}
            )
    except WebSocketDisconnect:
        await third_party_sync_hub.disconnect(websocket)
        return
