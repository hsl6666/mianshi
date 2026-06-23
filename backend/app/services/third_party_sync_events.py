from __future__ import annotations

import asyncio

from fastapi import WebSocket
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.models import (
    AttachmentType,
    BiddingCompany,
    BiddingProject,
    BiddingProjectGroup,
    GroupAttachment,
    ProjectAttachment,
    ThirdPartySyncStatus,
)
from app.schemas import ThirdPartyBiddingFileInfo, ThirdPartyBidFileOut, ThirdPartyFileOut
from app.services import bidding_projects as project_service


class ThirdPartySyncHub:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections.add(websocket)

    async def disconnect(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def broadcast_sync_batch(self, payload: ThirdPartyBiddingFileInfo) -> None:
        message = {"type": "sync_batch", "payload": payload.model_dump(mode="json")}
        async with self._lock:
            connections = list(self._connections)
        stale: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(message)
            except RuntimeError:
                stale.append(websocket)
        if stale:
            async with self._lock:
                for websocket in stale:
                    self._connections.discard(websocket)


third_party_sync_hub = ThirdPartySyncHub()


async def broadcast_bid_upload(db: Session, attachment_id: int) -> None:
    payload = build_bid_upload_sync_payload(db, attachment_id)
    if payload is not None:
        await third_party_sync_hub.broadcast_sync_batch(payload)


def build_bid_upload_sync_payload(
    db: Session,
    attachment_id: int,
) -> ThirdPartyBiddingFileInfo | None:
    attachment = db.scalar(
        select(ProjectAttachment)
        .where(
            ProjectAttachment.id == attachment_id,
            ProjectAttachment.attachment_type == AttachmentType.bid_doc,
            ProjectAttachment.third_party_sync_status == ThirdPartySyncStatus.unsynced,
        )
        .options(
            selectinload(ProjectAttachment.company)
            .selectinload(BiddingCompany.project)
            .selectinload(BiddingProject.group)
            .selectinload(BiddingProjectGroup.attachments),
            selectinload(ProjectAttachment.company)
            .selectinload(BiddingCompany.project)
            .selectinload(BiddingProject.attachments),
        )
    )
    if attachment is None or attachment.company is None:
        return None
    if not project_service.attachment_file_exists(attachment):
        return None

    project = attachment.company.project
    tender_file = next(
        (
            item
            for item in project_service.tender_attachments(project)
            if project_service.attachment_file_exists(item)
        ),
        None,
    )
    if tender_file is None:
        return None

    tender_download_path = (
        f"/bidding-files/group-tender/{tender_file.id}/download"
        if isinstance(tender_file, GroupAttachment)
        else f"/bidding-files/tender/{tender_file.id}/download"
    )
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
            download_url=_download_url(tender_download_path),
        ),
        bid_files=[
            ThirdPartyBidFileOut(
                id=attachment.id,
                project_id=project.id,
                company_id=attachment.company_id or 0,
                company_name=attachment.company.name,
                version_number=attachment.version_number or 1,
                original_name=attachment.original_name,
                size_bytes=attachment.size_bytes,
                third_party_sync_status=attachment.third_party_sync_status,
                download_url=_download_url(f"/bidding-files/bids/{attachment.id}/download"),
            )
        ],
    )


def _download_url(path: str) -> str:
    return f"/api/third-party{path}"
