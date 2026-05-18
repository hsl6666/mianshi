from app.models import InterviewSession
from app.schemas import SessionRead


def session_to_read(session: InterviewSession) -> SessionRead:
    return SessionRead(
        id=session.id,
        role=session.role,
        status=session.status,
        candidate_profile=session.candidate_profile or {},
        parsed_profile=session.parsed_profile or {},
        resume_text=session.resume_text or "",
        written_submission=session.written_submission or {},
        oral_summary=session.oral_summary or {},
        attachments=[
            {
                "id": item.id,
                "filename": item.filename,
                "content_type": item.content_type,
                "url": item.url,
                "created_at": item.created_at,
            }
            for item in session.attachments
        ],
        transcripts=[
            {
                "id": item.id,
                "speaker": item.speaker,
                "text": item.text,
                "event_type": item.event_type,
                "created_at": item.created_at,
            }
            for item in session.transcripts
        ],
        snapshots=[
            {
                "id": item.id,
                "filename": item.filename,
                "url": item.url,
                "capture_index": item.capture_index,
                "capture_reason": item.capture_reason,
                "created_at": item.created_at,
            }
            for item in session.snapshots
        ],
        oral_recordings=[
            {
                "id": item.id,
                "question_index": item.question_index,
                "question_text": item.question_text,
                "filename": item.filename,
                "content_type": item.content_type,
                "url": item.url,
                "duration_seconds": item.duration_seconds,
                "created_at": item.created_at,
            }
            for item in session.oral_recordings
        ],
        created_at=session.created_at,
        updated_at=session.updated_at,
    )
