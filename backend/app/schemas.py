from datetime import datetime
from typing import Any, Dict, List, Literal, Optional, Union

from pydantic import BaseModel, ConfigDict, Field

from app.models import AttachmentType, ProjectStatus, ReportStatus, ThirdPartySyncStatus, UserRole


class AttachmentOut(BaseModel):
    id: int
    attachment_type: AttachmentType
    original_name: str
    third_party_file_name: Optional[str] = None
    size_bytes: int
    version_number: Optional[int] = None
    analysis_status: bool = False
    report_status: ReportStatus = ReportStatus.pending
    third_party_sync_status: ThirdPartySyncStatus = ThirdPartySyncStatus.unsynced
    third_party_submission_file_id: Optional[str] = None
    report_original_name: Optional[str] = None
    report_size_bytes: Optional[int] = None
    report_uploaded_at: Optional[datetime] = None
    report_has_data: bool = False
    report_title: Optional[str] = None
    report_final_score: Optional[float] = None
    report_rating: Optional[str] = None
    report_feedback: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class TechnicalReportProjectInfo(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    project_no: Optional[str] = Field(default=None, max_length=100)
    bidder_name: Optional[str] = Field(default=None, max_length=200)
    review_date: Optional[str] = Field(default=None, max_length=40)
    construction_scale: Optional[str] = None
    construction_location: Optional[str] = Field(default=None, max_length=200)
    contract_estimate: Optional[str] = Field(default=None, max_length=100)
    duration_quality: Optional[str] = None
    bid_method: Optional[str] = Field(default=None, max_length=100)
    technical_full_score: Optional[float | str] = 100


class TechnicalReportScoreSummary(BaseModel):
    final_score: float = Field(ge=0)
    full_score: float = Field(default=100, gt=0)
    rating: Optional[str] = Field(default=None, max_length=100)
    score_range: Optional[str] = Field(default=None, max_length=100)
    confidence: Optional[str] = Field(default=None, max_length=40)
    submit_advice: Optional[str] = None


class TechnicalReportDimensionScore(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    score: float = Field(ge=0)
    max_score: float = Field(gt=0)
    comment: Optional[str] = None


class TechnicalReportIssue(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    priority: Literal["A", "B", "C"] = "B"
    severity: Literal["high", "medium", "low"] = "medium"
    location: Optional[str] = None
    problem: Optional[str] = None
    reason: Optional[str] = None
    suggestion: Optional[str] = None
    expected_score_gain: Optional[str] = Field(default=None, max_length=100)
    related_dimensions: List[str] = []


class TechnicalReportPriorityTasks(BaseModel):
    A: List[str] = []
    B: List[str] = []
    C: List[str] = []


class TechnicalReportScoreGainForecast(BaseModel):
    finish_A: Optional[str] = None
    finish_AB: Optional[str] = None
    finish_ABC: Optional[str] = None
    expected_after_revision: Optional[str] = None


class TechnicalReviewReportData(BaseModel):
    report_title: str = Field(default="技术文件AI模拟评审报告", min_length=1, max_length=200)
    subtitle: Optional[str] = Field(default=None, max_length=300)
    project_info: TechnicalReportProjectInfo
    score_summary: TechnicalReportScoreSummary
    dimension_scores: List[TechnicalReportDimensionScore] = []
    issues: List[TechnicalReportIssue] = []
    priority_tasks: TechnicalReportPriorityTasks = Field(default_factory=TechnicalReportPriorityTasks)
    score_gain_forecast: TechnicalReportScoreGainForecast = Field(default_factory=TechnicalReportScoreGainForecast)
    review_suggestion: Optional[str] = None
    disclaimer: Optional[str] = None


class TechnicalReviewReportContext(BaseModel):
    company_name: Optional[str] = None
    owner_username: Optional[str] = None
    owner_display_name: Optional[str] = None


class TechnicalReviewReportOut(BaseModel):
    attachment_id: int
    report_uploaded_at: datetime
    report_data: Dict[str, Any]
    context: Optional[TechnicalReviewReportContext] = None


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
    db_id: int
    project_name: str
    bid_opening_time: datetime
    project_id: Optional[str] = None
    project_code: Optional[str] = None
    evaluation_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0
    project_count: int = 0

    model_config = {"from_attributes": True}


class GroupDetail(BaseModel):
    db_id: int
    project_name: str
    bid_opening_time: datetime
    project_id: Optional[str] = None
    project_code: Optional[str] = None
    third_party_db_id: Optional[str] = None
    evaluation_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = []
    third_party_synced: Optional[bool] = None
    third_party_sync_error: Optional[str] = None

    model_config = {"from_attributes": True}


class GroupCreate(BaseModel):
    project_name: str = Field(min_length=1, max_length=200)
    bid_opening_time: datetime
    project_id: Optional[str] = Field(default=None, max_length=100)
    evaluation_date: Optional[datetime] = None


class GroupUpdate(BaseModel):
    project_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    bid_opening_time: Optional[datetime] = None
    project_id: Optional[str] = Field(default=None, max_length=100)
    evaluation_date: Optional[datetime] = None


class GroupThirdPartySync(BaseModel):
    third_party_db_id: str = Field(min_length=1, max_length=100)
    project_code: Optional[str] = Field(default=None, max_length=100)
    project_id: Optional[str] = Field(default=None, max_length=100)


class BidVersionListItem(BaseModel):
    row_type: Literal["version"] = "version"
    id: int
    company_id: int
    project_id: int
    version_number: int
    original_name: str
    third_party_file_name: Optional[str] = None
    size_bytes: int
    analysis_status: bool = False
    report_status: ReportStatus = ReportStatus.pending
    third_party_sync_status: ThirdPartySyncStatus = ThirdPartySyncStatus.unsynced
    third_party_submission_file_id: Optional[str] = None
    report_original_name: Optional[str] = None
    report_size_bytes: Optional[int] = None
    report_uploaded_at: Optional[datetime] = None
    report_has_data: bool = False
    report_title: Optional[str] = None
    report_final_score: Optional[float] = None
    report_rating: Optional[str] = None
    report_feedback: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyListItem(BaseModel):
    row_type: Literal["company"] = "company"
    id: int
    project_id: int
    name: str
    bid_opening_time: datetime
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
    db_id: int
    name: str
    participating_units: str
    bid_opening_time: datetime
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
    db_id: int
    project_name: str
    bid_opening_time: datetime
    project_id: Optional[str] = None
    project_code: Optional[str] = None
    evaluation_date: Optional[datetime] = None
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
    db_id: int
    project_name: str
    name: str
    participating_units: str
    bid_opening_time: datetime
    project_id: Optional[str] = None
    project_code: Optional[str] = None
    third_party_db_id: Optional[str] = None
    evaluation_date: Optional[datetime] = None
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
    db_id: Optional[int] = None
    project_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    bid_opening_time: Optional[datetime] = None
    project_id: Optional[str] = Field(default=None, max_length=100)
    third_party_file_name: Optional[str] = Field(default=None, max_length=255)
    evaluation_date: Optional[datetime] = None
    name: Optional[str] = Field(default=None, max_length=200)
    participating_units: str = Field(min_length=1, max_length=200)


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    participating_units: Optional[str] = Field(default=None, min_length=1, max_length=200)
    bid_opening_time: Optional[datetime] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)


class BidVersionAnalysisUpdate(BaseModel):
    analysis_status: bool


class BidVersionThirdPartySyncStatusUpdate(BaseModel):
    third_party_sync_status: ThirdPartySyncStatus


class BidVersionThirdPartySubmissionBind(BaseModel):
    submission_file_id: str = Field(min_length=1, max_length=100)
    status: Optional[str] = Field(default=None, max_length=40)
    report: Optional[Dict[str, Any]] = None
    report_data: Optional[Dict[str, Any]] = None


class BidVersionIssueFeedbackUpdate(BaseModel):
    feedback: Optional[Literal["like", "dislike"]] = None
    comment: Optional[str] = Field(default=None, max_length=2000)


class BidVersionReportFeedbackUpdate(BaseModel):
    feedback: str = Field(default="", max_length=2000)


class ReportFeedbackTagOut(BaseModel):
    id: int
    feedback_type: Literal["like", "dislike"]
    label: str
    sort_order: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReportFeedbackTagCreate(BaseModel):
    feedback_type: Literal["like", "dislike"]
    label: str = Field(min_length=1, max_length=64)
    sort_order: int = 0
    is_active: bool = True


class ReportFeedbackTagUpdate(BaseModel):
    feedback_type: Optional[Literal["like", "dislike"]] = None
    label: Optional[str] = Field(default=None, min_length=1, max_length=64)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ReportFeedbackEntryOut(BaseModel):
    id: int
    attachment_id: int
    issue_id: Optional[str] = None
    feedback_type: str
    tags: List[str] = Field(default_factory=list)
    comment: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    company_name: Optional[str] = None
    version_number: Optional[int] = None
    group_name: Optional[str] = None
    report_url: Optional[str] = None


class PaginatedReportFeedbackEntries(BaseModel):
    items: List[ReportFeedbackEntryOut]
    total: int
    page: int
    page_size: int


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
    db_id: int
    group_name: str
    project_name: str
    participating_units: str
    bid_opening_time: datetime
    project_code: Optional[str] = None
    third_party_project_id: Optional[str] = None
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


class PermissionActionOut(BaseModel):
    action: str
    label: str


class PermissionModuleOut(BaseModel):
    module: str
    label: str
    actions: List[PermissionActionOut]


class RoleOut(BaseModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    is_system: bool
    permissions: Dict[str, Dict[str, bool]]
    user_count: int = 0

    model_config = {"from_attributes": True}


class RoleListItem(BaseModel):
    id: int
    name: str
    code: str
    is_system: bool


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=255)
    permissions: Dict[str, Dict[str, bool]] = {}


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=64)
    description: Optional[str] = Field(default=None, max_length=255)


class RolePermissionsUpdate(BaseModel):
    permissions: Dict[str, Dict[str, bool]]


class CurrentUserOut(BaseModel):
    username: str
    role: UserRole
    display_name: Optional[str] = None
    is_super_admin: bool = False
    permissions: Dict[str, Dict[str, bool]] = {}

    model_config = {"from_attributes": True}


class UserOut(BaseModel):
    id: int
    username: str
    role: UserRole
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    is_active: bool
    display_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserCreate(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    role_id: int
    display_name: Optional[str] = Field(default=None, max_length=64)
    is_active: bool = True


class UserUpdate(BaseModel):
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    role_id: Optional[int] = None
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


class ThirdPartyProjectCreatePayload(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    project_id: Optional[str] = Field(default=None, max_length=100)
    project_name: Optional[str] = Field(default=None, max_length=200)
    third_party_file_name: Optional[str] = Field(default=None, max_length=255)
    bid_opening_time: Optional[datetime] = None
    evaluation_date: Optional[datetime] = None


class ThirdPartyProjectCreateResponseProject(BaseModel):
    db_id: int
    project_code: str
    project_id: Optional[str] = None
    project_name: Optional[str] = None
    bid_opening_time: Optional[datetime] = None
    evaluation_date: Optional[datetime] = None


class ThirdPartyProjectCreateResponse(BaseModel):
    project: ThirdPartyProjectCreateResponseProject


class ThirdPartyAnalyzeSubmissionFile(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str
    project_id: Optional[str] = None
    bidder_id: Optional[str] = None
    company_id: Optional[str] = None
    file_id: Optional[str] = None
    submission_version_id: Optional[str] = None
    version_no: Optional[int] = None
    version_name: Optional[str] = None
    file_name: Optional[str] = None
    third_party_file_name: Optional[str] = None
    parse_status: Optional[str] = None
    task_id: Optional[str] = None
    review_status: Optional[str] = None
    created_at: Optional[datetime] = None


class ThirdPartySubmissionAnalyzeResponse(BaseModel):
    model_config = ConfigDict(extra="allow")

    status: Optional[str] = None
    project_id: Optional[str] = None
    project_code: Optional[str] = None
    message: Optional[str] = None
    submission_file: Optional[ThirdPartyAnalyzeSubmissionFile] = None
    report: Optional[Dict[str, Any]] = None
    report_data: Optional[Dict[str, Any]] = None
