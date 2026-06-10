"""招投标 API 序列化：DB 字段映射为与第三方接口一致的响应字段名。"""

from __future__ import annotations

from app.models import (
    BiddingProject,
    BiddingProjectGroup,
    GroupAttachment,
    ProjectAttachment,
    ReportStatus,
    ThirdPartySyncStatus,
)
from app.schemas import AttachmentOut, GroupDetail, GroupListItem


def attachment_to_out(attachment: GroupAttachment | ProjectAttachment) -> AttachmentOut:
    return AttachmentOut(
        id=attachment.id,
        attachment_type=attachment.attachment_type,
        original_name=attachment.original_name,
        third_party_file_name=attachment.third_party_file_name or attachment.original_name,
        size_bytes=attachment.size_bytes,
        version_number=getattr(attachment, "version_number", None),
        analysis_status=bool(getattr(attachment, "analysis_status", False)),
        report_status=getattr(attachment, "report_status", None) or ReportStatus.pending,
        third_party_sync_status=getattr(
            attachment, "third_party_sync_status", ThirdPartySyncStatus.unsynced
        ),
        third_party_submission_file_id=getattr(attachment, "third_party_submission_file_id", None),
        report_original_name=getattr(attachment, "report_original_name", None),
        report_size_bytes=getattr(attachment, "report_size_bytes", None),
        report_uploaded_at=getattr(attachment, "report_uploaded_at", None),
        report_has_data=getattr(attachment, "report_has_data", False),
        report_title=getattr(attachment, "report_title", None),
        report_final_score=getattr(attachment, "report_final_score", None),
        report_project_amount=getattr(attachment, "report_project_amount", None),
        report_rating=getattr(attachment, "report_rating", None),
        report_feedback=getattr(attachment, "report_feedback", None),
        created_at=attachment.created_at,
    )


def group_to_list_item(group: BiddingProjectGroup) -> GroupListItem:
    return GroupListItem(
        db_id=group.id,
        project_name=group.name,
        bid_opening_time=group.bid_opening_at,
        project_id=group.third_party_project_id,
        project_code=group.project_code,
        evaluation_date=group.evaluation_date,
        created_at=group.created_at,
        updated_at=group.updated_at,
        attachment_count=len(group.attachments),
        project_count=len(group.projects),
    )


def group_to_detail(
    group: BiddingProjectGroup,
    *,
    third_party_synced: bool | None = None,
    third_party_sync_error: str | None = None,
) -> GroupDetail:
    return GroupDetail(
        db_id=group.id,
        project_name=group.name,
        bid_opening_time=group.bid_opening_at,
        project_id=group.third_party_project_id,
        project_code=group.project_code,
        third_party_db_id=group.third_party_db_id,
        evaluation_date=group.evaluation_date,
        created_at=group.created_at,
        updated_at=group.updated_at,
        attachments=[attachment_to_out(item) for item in group.attachments],
        third_party_synced=third_party_synced,
        third_party_sync_error=third_party_sync_error,
    )


def project_group_context(project: BiddingProject) -> dict:
    group = project.group
    return {
        "db_id": group.id,
        "project_name": group.name,
        "bid_opening_time": project.bid_opening_at,
        "project_id": group.third_party_project_id,
        "project_code": group.project_code,
        "third_party_db_id": group.third_party_db_id,
        "evaluation_date": group.evaluation_date,
    }
