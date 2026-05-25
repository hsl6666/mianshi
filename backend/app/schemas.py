from datetime import datetime
from typing import List, Literal, Optional, Union

from pydantic import BaseModel, Field

from app.models import AttachmentType, ProjectStatus, UserRole


class AttachmentOut(BaseModel):
    id: int
    attachment_type: AttachmentType
    original_name: str
    size_bytes: int
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


class ProjectListItem(BaseModel):
    row_type: Literal["project"] = "project"
    id: int
    group_id: int
    name: str
    participating_units: str
    bid_opening_at: datetime
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    final_score: Optional[float] = None
    ranking: Optional[int] = None

    model_config = {"from_attributes": True}


class GroupTreeItem(BaseModel):
    row_type: Literal["group"] = "group"
    id: int
    name: str
    bid_opening_at: datetime
    created_at: datetime
    updated_at: datetime
    attachment_count: int = 0
    children: List[ProjectListItem] = []

    model_config = {"from_attributes": True}


TreeRow = Union[GroupTreeItem, ProjectListItem]


class ProjectDetail(BaseModel):
    id: int
    group_id: int
    group_name: str
    name: str
    participating_units: str
    bid_opening_at: datetime
    status: ProjectStatus
    created_at: datetime
    updated_at: datetime
    attachments: List[AttachmentOut] = []
    feedback: Optional[FeedbackOut] = None

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    group_id: Optional[int] = None
    group_name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    group_bid_opening_at: Optional[datetime] = None
    name: str = Field(min_length=1, max_length=200)
    participating_units: str = Field(min_length=1, max_length=200)
    bid_opening_at: datetime


class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    participating_units: Optional[str] = Field(default=None, min_length=1, max_length=200)
    bid_opening_at: Optional[datetime] = None


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
