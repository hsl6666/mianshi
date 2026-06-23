from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import InterviewFlowConfigRead, InterviewFlowConfigUpdate
from app.services.interview_config import (
    get_or_create_interview_config,
    interview_config_to_read,
    update_interview_config,
)

router = APIRouter(tags=["interview-config"])


@router.get("/api/interview-config", response_model=InterviewFlowConfigRead)
def get_interview_config(db: Session = Depends(get_db)) -> InterviewFlowConfigRead:
    return interview_config_to_read(get_or_create_interview_config(db))


@router.get("/api/admin/interview-config", response_model=InterviewFlowConfigRead)
def get_admin_interview_config(db: Session = Depends(get_db)) -> InterviewFlowConfigRead:
    return interview_config_to_read(get_or_create_interview_config(db))


@router.put("/api/admin/interview-config", response_model=InterviewFlowConfigRead)
def save_interview_config(payload: InterviewFlowConfigUpdate, db: Session = Depends(get_db)) -> InterviewFlowConfigRead:
    return interview_config_to_read(update_interview_config(db, payload))
