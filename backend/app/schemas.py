from datetime import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field

from app.models import AttachmentType, ProjectStatus, ThirdPartySyncStatus, UserRole


class AttachmentOut(BaseModel):
    id: int
    attachment_type: AttachmentType
    original_name: str
    size_bytes: int
    version_number: Optional[int] = None
    analysis_status: bool = False
    third_party_sync_status: ThirdPartySyncStatus = ThirdPartySyncStatus.unsynced
    report_original_name: Optional[str] = None
    report_size_bytes: Optional[int] = None
    report_uploaded_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FeedbackOut(BaseModel):
    id: int
    final_score: float
    ranking: Optional[int] = None
    score_detail: Optional[str] = None
    remark: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GroupListItem(BaseModel):
    id: int
    name: str
    bid_opening_at: datetime
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0
    project_count: int = 0

    model_config = {"from_attributes": True}


class GroupDetail(BaseModel):
    id: int
    name: str
    bid_opening_at: datetime
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = []

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    bid_opening_at: datetime


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    bid_opening_at: Optional[datetime] = None


class BidVersionListItem(BaseModel):
    row_type: Literal["version"] = "version"
    id: int
    company_id: int
    project_id: int
    version_number: int
    original_name: str
    size_bytes: int
    analysis_status: bool = False
    third_party_sync_status: ThirdPartySyncStatus = ThirdPartySyncStatus.unsynced
    report_original_name: Optional[str] = None
    report_size_bytes: Optional[int] = None
    report_uploaded_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyListItem(BaseModel):
    row_type: Literal["company"] = "company"
    id: int
    project_id: int
    name: str
    bid_opening_at: datetime
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    version_count: int = 0
    final_score: Optional[float] = None
    ranking: Optional[int] = None
    children: List[BidVersionListItem] = []

    model_config = {"from_attributes": True}


class ProjectListItem(BaseModel):
    row_type: Literal["project"] = "project"
    id: int
    group_id: int
    name: str
    participating_units: str
    bid_opening_at: datetime
    status: ProjectStatus
    third_party_sync_status: ThirdPartySyncStatus = ThirdPartySyncStatus.unsynced
    created_at: datetime
    updated_at: datetime
    final_score: Optional[float] = None
    ranking: Optional[int] = None
    company_count: int = 0
    attachments: List[AttachmentOut] = []
    children: List[CompanyListItem] = []

    model_config = {"from_attributes": True}


class GroupTreeItem(BaseModel):
    row_type: Literal["group"] = "group"
    id: int
    name: str
    bid_opening_at: datetime
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0
    attachments: List[AttachmentOut] = []
    children: List[ProjectListItem] = []

    model_config = {"from_attributes": True}


TreeRow = Union[GroupTreeItem, ProjectListItem, CompanyListItem, BidVersionListItem]


class CompanyDetail(BaseModel):
    id: int
    project_id: int
    name: str
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = []
    feedback: Optional[FeedbackOut] = None

    model_config = {"from_attributes": True}


class ProjectDetail(BaseModel):
    id: int
    group_id: int
    group_name: str
    name: str
    participating_units: str
    bid_opening_at: datetime
    status: ProjectStatus
    third_party_sync_status: ThirdPartySyncStatus = ThirdPartySyncStatus.unsynced
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = []
    companies: List[CompanyDetail] = []

    model_config = {"from_attributes": True}


class ProjectFormOptions(BaseModel):
    project_names: List[str] = []
    company_names: List[str] = []


class ProjectCreate(BaseModel):
    group_id: Optional[int] = None
    group_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    group_bid_opening_at: Optional[datetime] = None
    name: str = Field(min_length=1, max_length=200)
    participating_units: str = Field(min_length=1, max_length=200)
    bid_opening_at: Optional[datetime] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    participating_units: Optional[str] = Field(default=None, min_length=1, max_length=200)
    bid_opening_at: Optional[datetime] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)


class BidVersionAnalysisUpdate(BaseModel):
    analysis_status: bool


class BidVersionThirdPartySyncStatusUpdate(BaseModel):
    third_party_sync_status: ThirdPartySyncStatus


class ProjectThirdPartySyncStatusUpdate(BaseModel):
    third_party_sync_status: ThirdPartySyncStatus


class FeedbackCreate(BaseModel):
    final_score: float = Field(ge=0, le=100)
    ranking: Optional[int] = Field(default=None, ge=1)
    score_detail: Optional[str] = None
    remark: Optional[str] = None


class PaginatedProjectTree(BaseModel):
    items: List[GroupTreeItem]
    total: int
    page: int
    page_size: int


class ThirdPartyFileOut(BaseModel):
    id: int
    project_id: int
    original_name: str
    size_bytes: int
    download_url: str


class ThirdPartyBidFileOut(ThirdPartyFileOut):
    company_id: int
    company_name: str
    version_number: int
    third_party_sync_status: ThirdPartySyncStatus


class ThirdPartyBiddingFileInfo(BaseModel):
    project_id: int
    group_id: int
    group_name: str
    project_name: str
    participating_units: str
    bid_opening_at: datetime
    third_party_sync_status: ThirdPartySyncStatus
    tender_file: ThirdPartyFileOut
    bid_files: List[ThirdPartyBidFileOut] = []


class ThirdPartyBidSyncAckIn(BaseModel):
    status: Literal["synced"] = "synced"
    source_system: Optional[str] = "mianshi"
    external_record_id: Optional[str] = None
    local_project_id: str
    local_company_id: str
    local_bid_file_id: str
    local_task_id: Optional[str] = None
    test_marker: Optional[str] = None


class ThirdPartyBidSyncAckOut(BaseModel):
    id: int
    project_id: int
    company_id: int
    third_party_sync_status: ThirdPartySyncStatus
    third_party_sync_metadata: Optional[str] = None


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    username: str
    role: UserRole
    display_name: Optional[str] = None


class CurrentUserOut(BaseModel):
    username: str
    role: UserRole
    display_name: Optional[str] = None
    is_super_admin: bool = False

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole
    is_active: bool
    display_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role: UserRole = UserRole.user
    display_name: Optional[str] = Field(default=None, max_length=64)
    is_active: bool = True


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    role: Optional[UserRole] = None
    display_name: Optional[str] = Field(default=None, max_length=64)
    is_active: Optional[bool] = None


class OperationLogOut(BaseModel):
    id: int
    username: str
    action: str
    module: str
    resource_type: Optional[str] = None
    resource_id: Optional[int] = None
    summary: str
    detail: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedOperationLogs(BaseModel):
    items: List[OperationLogOut]
    total: int
    page: int
    page_size: int
