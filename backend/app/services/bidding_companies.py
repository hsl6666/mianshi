from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.timezone import china_now
from app.models import (
    AttachmentType,
    BiddingCompany,
    BiddingProject,
    BiddingProjectGroup,
    CompanyFeedback,
    ProjectAttachment,
    ProjectStatus,
    ThirdPartySyncStatus,
)
from app.services.bidding_projects import company_status, sync_project_status


def sync_project_participating_units(project: BiddingProject) -> None:
    names = [company.name for company in sorted(project.companies, key=lambda c: c.id)]
    project.participating_units = "、".join(names) if names else ""


def get_company(db: Session, company_id: int, owner: str | None = None) -> BiddingCompany | None:
    query = (
        select(BiddingCompany)
        .join(BiddingProject)
        .join(BiddingProjectGroup)
        .where(BiddingCompany.id == company_id)
        .options(
            selectinload(BiddingCompany.project).selectinload(BiddingProject.group),
            selectinload(BiddingCompany.attachments),
            selectinload(BiddingCompany.feedback),
        )
    )
    if owner is not None:
        query = query.where(BiddingProjectGroup.owner == owner)
    return db.scalar(query)


def get_or_create_company(db: Session, project: BiddingProject, *, name: str) -> BiddingCompany:
    normalized = name.strip()
    existing = next((c for c in project.companies if c.name == normalized), None)
    if existing:
        return existing

    now = china_now()
    company = BiddingCompany(
        project_id=project.id,
        name=normalized,
        created_at=now,
        updated_at=now,
    )
    db.add(company)
    db.flush()
    db.refresh(project, attribute_names=["companies"])
    sync_project_participating_units(project)
    db.commit()
    db.refresh(company)
    return company


def next_bid_version_number(company: BiddingCompany) -> int:
    bid_attachments = [a for a in company.attachments if a.attachment_type == AttachmentType.bid_doc]
    if not bid_attachments:
        return 1
    return max(a.version_number or 0 for a in bid_attachments) + 1


def add_bid_version(
    db: Session,
    company: BiddingCompany,
    *,
    original_name: str,
    stored_name: str,
    size_bytes: int,
    content_type: str | None,
) -> ProjectAttachment:
    version_number = next_bid_version_number(company)
    attachment = ProjectAttachment(
        project_id=company.project_id,
        company_id=company.id,
        attachment_type=AttachmentType.bid_doc,
        original_name=original_name,
        stored_name=stored_name,
        size_bytes=size_bytes,
        content_type=content_type,
        version_number=version_number,
        created_at=china_now(),
    )
    db.add(attachment)
    company.updated_at = china_now()
    db.commit()
    db.refresh(attachment)
    return attachment


def get_bid_attachment(
    db: Session,
    attachment_id: int,
    owner: str | None = None,
) -> ProjectAttachment | None:
    query = (
        select(ProjectAttachment)
        .join(BiddingCompany, ProjectAttachment.company_id == BiddingCompany.id)
        .join(BiddingProject, BiddingCompany.project_id == BiddingProject.id)
        .join(BiddingProjectGroup, BiddingProject.group_id == BiddingProjectGroup.id)
        .where(
            ProjectAttachment.id == attachment_id,
            ProjectAttachment.attachment_type == AttachmentType.bid_doc,
        )
        .options(
            selectinload(ProjectAttachment.company).selectinload(BiddingCompany.project),
        )
    )
    if owner is not None:
        query = query.where(BiddingProjectGroup.owner == owner)
    return db.scalar(query)


def delete_bid_version(db: Session, attachment: ProjectAttachment) -> None:
    settings = get_settings()
    file_path = settings.uploads_dir / attachment.stored_name
    if file_path.exists():
        file_path.unlink()
    if attachment.report_stored_name:
        report_path = settings.uploads_dir / attachment.report_stored_name
        if report_path.exists():
            report_path.unlink()
    company = attachment.company
    db.delete(attachment)
    db.flush()
    if company:
        company.updated_at = china_now()
    db.commit()


def update_bid_analysis_status(
    db: Session,
    attachment: ProjectAttachment,
    *,
    analysis_status: bool,
) -> ProjectAttachment:
    attachment.analysis_status = analysis_status
    if attachment.company:
        attachment.company.updated_at = china_now()
    db.commit()
    db.refresh(attachment)
    return attachment


def update_bid_third_party_sync_status(
    db: Session,
    attachment: ProjectAttachment,
    *,
    third_party_sync_status: ThirdPartySyncStatus,
) -> ProjectAttachment:
    attachment.third_party_sync_status = third_party_sync_status
    if attachment.company:
        attachment.company.updated_at = china_now()
    db.commit()
    db.refresh(attachment)
    return attachment


def mark_bid_attachments_synced(db: Session, attachments: list[ProjectAttachment]) -> None:
    now = china_now()
    for attachment in attachments:
        attachment.third_party_sync_status = ThirdPartySyncStatus.synced
        if attachment.company:
            attachment.company.updated_at = now
    db.commit()


def replace_bid_report(
    db: Session,
    attachment: ProjectAttachment,
    *,
    original_name: str,
    stored_name: str,
    size_bytes: int,
    content_type: str | None,
) -> ProjectAttachment:
    settings = get_settings()
    if attachment.report_stored_name:
        old_path = settings.uploads_dir / attachment.report_stored_name
        if old_path.exists():
            old_path.unlink()

    now = china_now()
    attachment.report_original_name = original_name
    attachment.report_stored_name = stored_name
    attachment.report_size_bytes = size_bytes
    attachment.report_content_type = content_type
    attachment.report_uploaded_at = now
    attachment.analysis_status = True
    if attachment.company:
        attachment.company.updated_at = now
    db.commit()
    db.refresh(attachment)
    return attachment


def update_company(db: Session, company: BiddingCompany, *, name: str | None = None) -> BiddingCompany:
    if name is not None:
        company.name = name.strip()
        company.updated_at = china_now()
    db.flush()
    sync_project_participating_units(company.project)
    db.commit()
    db.refresh(company)
    return company


def delete_company(db: Session, company: BiddingCompany) -> None:
    project = company.project
    db.delete(company)
    db.flush()
    db.refresh(project, attribute_names=["companies"])
    sync_project_participating_units(project)
    db.commit()


def sorted_bid_versions(company: BiddingCompany) -> list[ProjectAttachment]:
    bids = [a for a in company.attachments if a.attachment_type == AttachmentType.bid_doc]
    return sorted(bids, key=lambda a: (a.version_number or 0, a.id), reverse=True)


def submit_feedback(
    db: Session,
    company: BiddingCompany,
    *,
    final_score: float,
    ranking: int | None,
    score_detail: str | None,
    remark: str | None,
) -> CompanyFeedback:
    project = company.project
    if company_status(company, project) == ProjectStatus.registered:
        raise ValueError("开标时间未到，暂不可提交评审反馈")
    now = china_now()
    if company.feedback is not None:
        company.feedback.final_score = final_score
        company.feedback.ranking = ranking
        company.feedback.score_detail = score_detail
        company.feedback.remark = remark
        company.feedback.updated_at = now
        feedback = company.feedback
    else:
        feedback = CompanyFeedback(
            company_id=company.id,
            final_score=final_score,
            ranking=ranking,
            score_detail=score_detail,
            remark=remark,
            created_at=now,
            updated_at=now,
        )
        db.add(feedback)
    company.updated_at = now
    sync_project_status(project)
    db.commit()
    db.refresh(feedback)
    return feedback
