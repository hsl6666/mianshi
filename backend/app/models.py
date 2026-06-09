from __future__ import annotations

import enum
import json
from datetime import datetime
from typing import List, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.timezone import china_now
from app.db import Base


class ProjectStatus(str, enum.Enum):
    registered = "registered"
    awaiting_feedback = "awaiting_feedback"
    completed = "completed"


class ThirdPartySyncStatus(str, enum.Enum):
    unsynced = "unsynced"
    synced = "synced"


class ReportStatus(str, enum.Enum):
    pending = "pending"
    analyzing = "analyzing"
    completed = "completed"
    failed = "failed"


class AttachmentType(str, enum.Enum):
    tender_doc = "tender_doc"
    bid_doc = "bid_doc"


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    user = "user"


class Role(Base):
    __tablename__ = "roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(String(255))
    is_system: Mapped[bool] = mapped_column(default=False, nullable=False)
    permissions_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        onupdate=china_now,
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.user, nullable=False)
    role_id: Mapped[Optional[int]] = mapped_column(ForeignKey("roles.id"), nullable=True, index=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(64))
    permissions_json: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        onupdate=china_now,
    )

    role_ref: Mapped[Optional[Role]] = relationship("Role", foreign_keys=[role_id])


class OperationLog(Base):
    __tablename__ = "operation_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    module: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    resource_type: Mapped[Optional[str]] = mapped_column(String(64))
    resource_id: Mapped[Optional[int]] = mapped_column(Integer)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        index=True,
    )


class BiddingProjectGroup(Base):
    __tablename__ = "bidding_project_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    owner: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    third_party_project_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    third_party_db_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    project_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    bid_opening_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False, index=True)
    evaluation_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        onupdate=china_now,
    )

    attachments: Mapped[List["GroupAttachment"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )
    projects: Mapped[List["BiddingProject"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
    )


class GroupAttachment(Base):
    __tablename__ = "group_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("bidding_project_groups.id", ondelete="CASCADE"),
        index=True,
    )
    attachment_type: Mapped[AttachmentType] = mapped_column(Enum(AttachmentType), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    third_party_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)

    group: Mapped[BiddingProjectGroup] = relationship(back_populates="attachments")


class ProjectAttachment(Base):
    __tablename__ = "project_attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("bidding_projects.id", ondelete="CASCADE"),
        index=True,
    )
    company_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("bidding_companies.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    attachment_type: Mapped[AttachmentType] = mapped_column(Enum(AttachmentType), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    third_party_file_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    stored_name: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[Optional[str]] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    version_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    analysis_status: Mapped[bool] = mapped_column(default=False, nullable=False)
    report_status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus),
        default=ReportStatus.pending,
        nullable=False,
    )
    third_party_sync_status: Mapped[ThirdPartySyncStatus] = mapped_column(
        Enum(ThirdPartySyncStatus),
        default=ThirdPartySyncStatus.unsynced,
        nullable=False,
    )
    third_party_sync_metadata: Mapped[Optional[str]] = mapped_column(Text)
    third_party_submission_file_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    report_original_name: Mapped[Optional[str]] = mapped_column(String(255))
    report_stored_name: Mapped[Optional[str]] = mapped_column(String(255))
    report_content_type: Mapped[Optional[str]] = mapped_column(String(128))
    report_size_bytes: Mapped[Optional[int]] = mapped_column(Integer)
    report_uploaded_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=False))
    report_data: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)

    project: Mapped["BiddingProject"] = relationship(back_populates="attachments")
    company: Mapped[Optional["BiddingCompany"]] = relationship(back_populates="attachments")

    @property
    def report_has_data(self) -> bool:
        return bool(self.report_data)

    @property
    def report_title(self) -> str | None:
        data = self._report_data_dict()
        for key in ("title", "report_title"):
            value = data.get(key)
            if value:
                return str(value)
        return None

    @property
    def report_final_score(self) -> float | None:
        data = self._report_data_dict()
        summary = data.get("score_summary")
        if isinstance(summary, dict):
            value = summary.get("final_score")
            try:
                return float(value) if value is not None else None
            except (TypeError, ValueError):
                pass

        scoring = data.get("scoring")
        if isinstance(scoring, dict):
            value = scoring.get("total_simulated_score")
            try:
                return float(value) if value is not None else None
            except (TypeError, ValueError):
                return None
        return None

    @property
    def report_rating(self) -> str | None:
        data = self._report_data_dict()
        summary = data.get("score_summary")
        if isinstance(summary, dict):
            value = summary.get("rating")
            if value:
                return str(value)

        scoring = data.get("scoring")
        if isinstance(scoring, dict):
            value = scoring.get("score_interval_judgement")
            if value:
                return str(value)
        return None

    def _report_data_dict(self) -> dict:
        if not self.report_data:
            return {}
        try:
            value = json.loads(self.report_data)
        except json.JSONDecodeError:
            return {}
        return value if isinstance(value, dict) else {}


class BiddingCompany(Base):
    __tablename__ = "bidding_companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(
        ForeignKey("bidding_projects.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        onupdate=china_now,
    )

    project: Mapped["BiddingProject"] = relationship(back_populates="companies")
    attachments: Mapped[List["ProjectAttachment"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        foreign_keys="ProjectAttachment.company_id",
    )
    feedback: Mapped[Optional["CompanyFeedback"]] = relationship(
        back_populates="company",
        cascade="all, delete-orphan",
        uselist=False,
    )


class BiddingProject(Base):
    __tablename__ = "bidding_projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    group_id: Mapped[int] = mapped_column(
        ForeignKey("bidding_project_groups.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    participating_units: Mapped[str] = mapped_column(Text, nullable=False)
    bid_opening_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(ProjectStatus),
        default=ProjectStatus.registered,
        nullable=False,
    )
    third_party_sync_status: Mapped[ThirdPartySyncStatus] = mapped_column(
        Enum(ThirdPartySyncStatus),
        default=ThirdPartySyncStatus.unsynced,
        nullable=False,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        onupdate=china_now,
    )

    group: Mapped[BiddingProjectGroup] = relationship(back_populates="projects")
    companies: Mapped[List["BiddingCompany"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="BiddingCompany.id",
    )
    attachments: Mapped[List["ProjectAttachment"]] = relationship(
        back_populates="project",
        cascade="all, delete-orphan",
        foreign_keys="ProjectAttachment.project_id",
    )


class CompanyFeedback(Base):
    __tablename__ = "company_feedbacks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        ForeignKey("bidding_companies.id", ondelete="CASCADE"),
        unique=True,
        index=True,
    )
    final_score: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    ranking: Mapped[Optional[int]] = mapped_column(Integer)
    score_detail: Mapped[Optional[str]] = mapped_column(Text)
    remark: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=china_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=False),
        default=china_now,
        onupdate=china_now,
    )

    company: Mapped[BiddingCompany] = relationship(back_populates="feedback")
