from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import InterviewSession
from app.services.reports import build_result_detail, build_result_summary

router = APIRouter(tags=["results"])


@router.get("/api/interview-results")
def list_interview_results(db: Session = Depends(get_db)) -> list[dict]:
    sessions = db.query(InterviewSession).order_by(InterviewSession.updated_at.desc()).all()
    return [build_result_summary(session) for session in sessions]


@router.get("/api/interview-results/{session_id}")
def get_interview_result(session_id: str, db: Session = Depends(get_db)) -> dict:
    session = db.get(InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return build_result_detail(session)
