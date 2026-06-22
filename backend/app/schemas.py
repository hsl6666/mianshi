from __future__ import annotations

from datetime import datetime
from typing import Literal
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field


class CandidateProfile(BaseModel):
    profile_photo_data_url: str = ""
    name: str = ""
    age: str = ""
    id_number: str = ""
    phone: str = ""
    email: str = ""
    role: str = ""
    fill_date: str = ""
    gender: str = ""
    birth_month: str = ""
    nation: str = ""
    native_place: str = ""
    height: str = ""
    weight: str = ""
    marital_status: str = ""
    political_status: str = ""
    education_level: str = ""
    school: str = ""
    major: str = ""
    degree: str = ""
    graduation_year: str = ""
    registered_address: str = ""
    current_address: str = ""
    work_experiences: list[dict] = Field(default_factory=list)
    education_experiences: list[dict] = Field(default_factory=list)
    family_members: list[dict] = Field(default_factory=list)
    emergency_contact: str = ""
    emergency_relation: str = ""
    emergency_phone: str = ""
    expected_salary: str = ""
    self_evaluation: str = ""


class SessionCreate(BaseModel):
    session_id: Optional[str] = None
    role: str = ""
    candidate_profile: CandidateProfile = Field(default_factory=CandidateProfile)


class SessionUpdate(BaseModel):
    role: Optional[str] = None
    candidate_profile: Optional[CandidateProfile] = None
    status: Optional[str] = None


class AttachmentRead(BaseModel):
    id: str
    filename: str
    content_type: str
    url: str
    created_at: datetime


class TranscriptRead(BaseModel):
    id: int
    speaker: str
    text: str
    event_type: str
    created_at: datetime


class SnapshotRead(BaseModel):
    id: str
    filename: str
    url: str
    capture_index: int
    capture_reason: str
    created_at: datetime


class OralRecordingRead(BaseModel):
    id: str
    question_index: int
    question_text: str
    filename: str
    content_type: str
    url: str
    duration_seconds: int
    created_at: datetime


class SessionRead(BaseModel):
    id: str
    role: str
    status: str
    candidate_profile: dict
    parsed_profile: dict
    resume_text: str
    written_submission: dict
    oral_summary: dict
    attachments: list[AttachmentRead]
    transcripts: list[TranscriptRead]
    snapshots: list[SnapshotRead]
    oral_recordings: list[OralRecordingRead]
    created_at: datetime
    updated_at: datetime


class QuestionOption(BaseModel):
    label: str
    value: str


class Question(BaseModel):
    id: str
    title: str
    type: Literal["single", "multi", "short", "code"]
    options: list[QuestionOption] = Field(default_factory=list)
    prompt: str = ""
    starter_code: str = ""
    language: str = "typescript"


class WrittenQuestionCreate(BaseModel):
    title: str
    type: Literal["single", "multi", "short", "code"]
    prompt: str
    options: list[QuestionOption] = Field(default_factory=list)
    starter_code: str = ""
    language: str = "typescript"
    role_tags: str = ""
    difficulty: str = "medium"
    source: str = "manual"
    evaluation_points: str = ""
    published: bool = False


class WrittenQuestionUpdate(BaseModel):
    title: Optional[str] = None
    type: Optional[Literal["single", "multi", "short", "code"]] = None
    prompt: Optional[str] = None
    options: Optional[list[QuestionOption]] = None
    starter_code: Optional[str] = None
    language: Optional[str] = None
    role_tags: Optional[str] = None
    difficulty: Optional[str] = None
    source: Optional[str] = None
    evaluation_points: Optional[str] = None
    published: Optional[bool] = None


class WrittenQuestionRead(Question):
    model_config = ConfigDict(from_attributes=True)

    role_tags: str = ""
    difficulty: str = "medium"
    source: str = "manual"
    evaluation_points: str = ""
    published: bool = False
    created_at: datetime
    updated_at: datetime


class OralQuestionCreate(BaseModel):
    title: str
    prompt: str
    role_tags: str = ""
    difficulty: str = "medium"
    source: str = "manual"
    sort_order: int = 0
    published: bool = False


class OralQuestionUpdate(BaseModel):
    title: Optional[str] = None
    prompt: Optional[str] = None
    role_tags: Optional[str] = None
    difficulty: Optional[str] = None
    source: Optional[str] = None
    sort_order: Optional[int] = None
    published: Optional[bool] = None


class OralQuestionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    prompt: str
    role_tags: str = ""
    difficulty: str = "medium"
    source: str = "manual"
    sort_order: int = 0
    published: bool = False
    created_at: datetime
    updated_at: datetime


class QuestionGenerationRequest(BaseModel):
    role: str = ""
    count: int = Field(default=5, ge=1, le=20)
    system_prompt: str = ""
    user_prompt: str = ""
    difficulty: str = "medium"
    question_types: list[Literal["single", "multi", "short", "code"]] = Field(default_factory=list)


class QuestionGenerationResponse(BaseModel):
    questions: list[Question]
    system_prompt: str
    fallback_used: bool = False


class LlmModelConfigRead(BaseModel):
    provider: str
    model: str
    api_base_url: str
    enabled: bool
    has_api_key: bool
    api_key_masked: str = ""
    updated_at: datetime


class LlmModelConfigUpdate(BaseModel):
    provider: str
    model: str
    api_base_url: str = ""
    api_key: Optional[str] = None
    enabled: bool = True
    clear_api_key: bool = False


class JobPositionCreate(BaseModel):
    name: str
    description: str = ""
    enabled: bool = True
    sort_order: int = 0


class JobPositionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    enabled: Optional[bool] = None
    sort_order: Optional[int] = None


class JobPositionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    enabled: bool
    sort_order: int
    created_at: datetime
    updated_at: datetime


class WrittenExamSubmission(BaseModel):
    session_id: str
    role: str
    started_at: Optional[datetime] = None
    submitted_at: datetime
    duration_seconds: int
    answers: Dict[str, Union[str, List[str]]]


class RtcOffer(BaseModel):
    session_id: str
    sdp: str
    type: str


class RtcAnswer(BaseModel):
    sdp: str
    type: str


class OralStartRequest(BaseModel):
    session_id: str


class OralRespondRequest(BaseModel):
    session_id: str
    text: str


class OralMessageResponse(BaseModel):
    assistant_text: str
    stage: str


class OralSummaryRequest(BaseModel):
    session_id: str
    qa: list[dict]
    ended_at: datetime
