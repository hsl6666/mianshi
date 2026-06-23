from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import AssistantChatRequest, AssistantChatResponse
from app.services.interview_assistant import answer_interview_question
from app.services.llm_config import LlmConfigError, LlmProviderError

router = APIRouter(tags=["interview-assistant"])


@router.post("/api/admin/interview-assistant/chat", response_model=AssistantChatResponse)
async def chat_with_interview_assistant(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
) -> AssistantChatResponse:
    try:
        result = await answer_interview_question(
            db,
            session_id=payload.session_id,
            messages=[{"role": item.role, "content": item.content} for item in payload.messages],
        )
        return AssistantChatResponse(**result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LlmConfigError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except LlmProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
