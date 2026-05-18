from __future__ import annotations

from datetime import datetime
from typing import Literal
from typing import Dict, List, Optional, Union

from pydantic import BaseModel, Field


class CandidateProfile(BaseModel):
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
