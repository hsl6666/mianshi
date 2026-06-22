import shutil

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db import get_db
from app.models import InterviewSession
from app.services.reports import build_result_detail, build_result_summary

router = APIRouter(tags=["results"])


@router.get("/api/interview-results")
def list_interview_results(db: Session = Depends(get_db)) -> list[dict]:
    sessions = db.query(InterviewSession).order_by(InterviewSession.updated_at.desc()).all()
    return [build_result_summary(session) for session in sessions]


@router.delete("/api/interview-results")
def delete_all_interview_results(db: Session = Depends(get_db)) -> dict[str, int]:
    sessions = db.query(InterviewSession).all()
    session_ids = [session.id for session in sessions]
    deleted_count = len(session_ids)

    for session in sessions:
        db.delete(session)
    db.commit()

    settings = get_settings()
    for session_id in session_ids:
        _delete_session_artifacts(settings, session_id)

    return {"deleted_count": deleted_count}


@router.get("/api/interview-results/{session_id}")
def get_interview_result(session_id: str, db: Session = Depends(get_db)) -> dict:
    session = db.get(InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")
    return build_result_detail(session)


@router.delete("/api/interview-results/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_interview_result(session_id: str, db: Session = Depends(get_db)) -> None:
    session = db.get(InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="session not found")

    settings = get_settings()
    db.delete(session)
    db.commit()
    _delete_session_artifacts(settings, session_id)


def _delete_session_artifacts(settings, session_id: str) -> None:
    for base_dir in (settings.uploads_dir, settings.snapshots_dir, settings.oral_recordings_dir):
        session_dir = base_dir / session_id
        if session_dir.exists():
            shutil.rmtree(session_dir, ignore_errors=True)
