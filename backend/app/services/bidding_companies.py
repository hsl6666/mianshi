from __future__ import annotations

import json

from sqlalchemy import select
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
    ReportStatus,
    ThirdPartySyncStatus,
)
from app.services.third_party_bidding_client import analyze_submission_file
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
    third_party_file_name: str | None = None,
) -> ProjectAttachment:
    version_number = next_bid_version_number(company)
    attachment = ProjectAttachment(
        project_id=company.project_id,
        company_id=company.id,
        attachment_type=AttachmentType.bid_doc,
        original_name=original_name,
        third_party_file_name=third_party_file_name or original_name,
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


def extract_submission_file_id(payload: dict) -> str | None:
    submission_file_id = payload.get("submission_file_id")
    if isinstance(submission_file_id, str) and submission_file_id.strip():
        return submission_file_id.strip()

    submission_file = payload.get("submission_file")
    if isinstance(submission_file, dict):
        file_id = submission_file.get("id")
        if isinstance(file_id, str) and file_id.strip():
            return file_id.strip()
    return None


def get_bid_attachment_by_submission_file_id(
    db: Session,
    submission_file_id: str,
    owner: str | None = None,
) -> ProjectAttachment | None:
    query = (
        select(ProjectAttachment)
        .join(BiddingCompany, ProjectAttachment.company_id == BiddingCompany.id)
        .join(BiddingProject, BiddingCompany.project_id == BiddingProject.id)
        .join(BiddingProjectGroup, BiddingProject.group_id == BiddingProjectGroup.id)
        .where(
            ProjectAttachment.third_party_submission_file_id == submission_file_id,
            ProjectAttachment.attachment_type == AttachmentType.bid_doc,
        )
        .options(
            selectinload(ProjectAttachment.company)
            .selectinload(BiddingCompany.project)
            .selectinload(BiddingProject.group),
        )
    )
    if owner is not None:
        query = query.where(BiddingProjectGroup.owner == owner)
    return db.scalar(query)


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
            selectinload(ProjectAttachment.company)
            .selectinload(BiddingCompany.project)
            .selectinload(BiddingProject.group),
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


def resolve_third_party_project_id(group: BiddingProjectGroup) -> str:
    if group.third_party_db_id:
        return group.third_party_db_id
    if group.third_party_project_id:
        return group.third_party_project_id
    if group.project_code:
        return group.project_code
    raise ValueError("项目未配置第三方 project_id，请先在项目组中填写第三方项目编号")


def update_bid_report_status(
    db: Session,
    attachment: ProjectAttachment,
    *,
    report_status: ReportStatus,
) -> ProjectAttachment:
    attachment.report_status = report_status
    if attachment.company:
        attachment.company.updated_at = china_now()
    db.commit()
    db.refresh(attachment)
    return attachment


async def analyze_bid_version(
    db: Session,
    attachment: ProjectAttachment,
    *,
    access_token: str,
    base_url: str,
) -> ProjectAttachment:
    if attachment.third_party_submission_file_id:
        return attachment

    if attachment.report_status == ReportStatus.analyzing:
        raise ValueError("该版本正在分析中，请稍后再试")

    company = attachment.company
    if not company:
        raise ValueError("投标文件缺少投标单位信息")

    project = company.project
    if not project or not project.group:
        raise ValueError("投标文件缺少项目信息")

    group = project.group
    project_id = resolve_third_party_project_id(group)

    settings = get_settings()
    file_path = settings.uploads_dir / attachment.stored_name
    if not file_path.exists():
        raise ValueError("投标文件不存在")

    attachment.report_status = ReportStatus.analyzing
    if attachment.company:
        attachment.company.updated_at = china_now()
    db.commit()

    try:
        result = await analyze_submission_file(
            base_url=base_url,
            access_token=access_token,
            project_id=project_id,
            project_code=group.project_code,
            company_name=company.name,
            response_file_name=attachment.original_name,
            response_file_bytes=file_path.read_bytes(),
            response_file_content_type=attachment.content_type,
            third_party_file_name=attachment.third_party_file_name or attachment.original_name,
            third_party_company_name=company.name,
        )
    except Exception:
        attachment.report_status = ReportStatus.failed
        if attachment.company:
            attachment.company.updated_at = china_now()
        db.commit()
        db.refresh(attachment)
        raise

    now = china_now()
    submission_file_id = result.submission_file.id if result.submission_file else None
    if not submission_file_id:
        attachment.report_status = ReportStatus.failed
        if attachment.company:
            attachment.company.updated_at = now
        db.commit()
        db.refresh(attachment)
        raise ValueError("第三方响应缺少 submission_file.id，无法关联投标文件")

    existing = db.scalar(
        select(ProjectAttachment.id)
        .where(
            ProjectAttachment.third_party_submission_file_id == submission_file_id,
            ProjectAttachment.id != attachment.id,
        )
        .limit(1)
    )
    if existing is not None:
        attachment.report_status = ReportStatus.failed
        if attachment.company:
            attachment.company.updated_at = now
        db.commit()
        db.refresh(attachment)
        raise ValueError(f"第三方 submission_file.id={submission_file_id} 已关联其他投标文件")

    attachment.third_party_submission_file_id = submission_file_id

    report_payload = result.report or result.report_data
    if isinstance(report_payload, dict):
        attachment.report_data = json.dumps(report_payload, ensure_ascii=False, sort_keys=True)
        attachment.report_uploaded_at = now
        attachment.report_status = ReportStatus.completed
        attachment.analysis_status = True
    elif (result.status or "").lower() == "accepted":
        # 第三方异步受理，保持 analyzing，等待后续查报告
        pass
    else:
        attachment.report_status = ReportStatus.completed
        attachment.analysis_status = True

    if attachment.company:
        attachment.company.updated_at = now
    db.commit()
    db.refresh(attachment)
    return attachment


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


def bind_third_party_submission(
    db: Session,
    attachment: ProjectAttachment,
    *,
    submission_file_id: str,
    status: str | None = None,
    report: dict | None = None,
    report_data: dict | None = None,
) -> ProjectAttachment:
    normalized_id = submission_file_id.strip()
    if not normalized_id:
        raise ValueError("submission_file_id 不能为空")

    existing = db.scalar(
        select(ProjectAttachment.id)
        .where(
            ProjectAttachment.third_party_submission_file_id == normalized_id,
            ProjectAttachment.id != attachment.id,
        )
        .limit(1)
    )
    if existing is not None:
        raise ValueError(f"第三方 submission_file.id={normalized_id} 已关联其他投标文件")

    now = china_now()
    attachment.third_party_submission_file_id = normalized_id
    report_payload = report if isinstance(report, dict) else report_data
    if isinstance(report_payload, dict):
        attachment.report_data = json.dumps(report_payload, ensure_ascii=False, sort_keys=True)
        attachment.report_uploaded_at = now
        attachment.report_status = ReportStatus.completed
        attachment.analysis_status = True
    elif (status or "").lower() == "failed":
        attachment.report_status = ReportStatus.failed
    else:
        attachment.report_status = ReportStatus.analyzing

    if attachment.company:
        attachment.company.updated_at = now
    db.commit()
    db.refresh(attachment)
    return attachment


def ack_bid_third_party_sync(
    db: Session,
    attachment: ProjectAttachment,
    *,
    metadata: dict[str, object],
) -> ProjectAttachment:
    now = china_now()
    attachment.third_party_sync_status = ThirdPartySyncStatus.synced
    attachment.third_party_sync_metadata = json.dumps(
        metadata,
        ensure_ascii=False,
        sort_keys=True,
    )
    if attachment.company:
        attachment.company.updated_at = now

    project = db.get(BiddingProject, attachment.project_id)
    if project is not None:
        remaining_unsynced_bid_id = db.scalar(
            select(ProjectAttachment.id)
            .where(
                ProjectAttachment.project_id == project.id,
                ProjectAttachment.id != attachment.id,
                ProjectAttachment.attachment_type == AttachmentType.bid_doc,
                ProjectAttachment.third_party_sync_status == ThirdPartySyncStatus.unsynced,
            )
            .limit(1)
        )
        if remaining_unsynced_bid_id is None:
            project.third_party_sync_status = ThirdPartySyncStatus.synced
            project.updated_at = now

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
    attachment.report_status = ReportStatus.completed
    if attachment.company:
        attachment.company.updated_at = now
    db.commit()
    db.refresh(attachment)
    return attachment


def replace_bid_report_data(
    db: Session,
    attachment: ProjectAttachment,
    *,
    report_data: dict,
) -> ProjectAttachment:
    now = china_now()
    attachment.report_data = json.dumps(report_data, ensure_ascii=False, sort_keys=True)
    attachment.report_uploaded_at = now
    attachment.analysis_status = True
    attachment.report_status = ReportStatus.completed
    if attachment.company:
        attachment.company.updated_at = now
    db.commit()
    db.refresh(attachment)
    return attachment


def get_bid_report_data(attachment: ProjectAttachment) -> dict | None:
    if not attachment.report_data:
        return None
    try:
        value = json.loads(attachment.report_data)
    except json.JSONDecodeError:
        return None
    return value if isinstance(value, dict) else None


def update_bid_report_issue_feedback(
    db: Session,
    attachment: ProjectAttachment,
    *,
    issue_id: str,
    feedback: str | None,
) -> dict | None:
    report_data = get_bid_report_data(attachment)
    if report_data is None:
        return None

    issues = report_data.get("issues")
    if not isinstance(issues, list):
        nested_report = report_data.get("report")
        issues = nested_report.get("issues") if isinstance(nested_report, dict) else None

    if not isinstance(issues, list):
        return None

    normalized_issue_id = issue_id.strip()
    for issue in issues:
        if not isinstance(issue, dict):
            continue
        candidate = str(issue.get("number") or issue.get("id") or issue.get("issue_id") or "").strip()
        if candidate != normalized_issue_id:
            continue

        if feedback is None:
            issue.pop("feedback", None)
            issue.pop("feedback_status", None)
            issue.pop("feedbackStatus", None)
            issue.pop("user_feedback", None)
        else:
            issue["feedback"] = feedback

        attachment.report_data = json.dumps(report_data, ensure_ascii=False, sort_keys=True)
        if attachment.company:
            attachment.company.updated_at = china_now()
        db.commit()
        db.refresh(attachment)
        return report_data

    return None


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
