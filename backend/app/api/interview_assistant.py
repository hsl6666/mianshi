import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import AssistantChatRequest, AssistantChatResponse
from app.services.interview_assistant import answer_interview_question, stream_interview_answer
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


@router.post("/api/admin/interview-assistant/chat/stream")
async def stream_chat_with_interview_assistant(
    payload: AssistantChatRequest,
    db: Session = Depends(get_db),
) -> StreamingResponse:
    async def event_generator():
        try:
            async for chunk in stream_interview_answer(
                db,
                session_id=payload.session_id,
                messages=[{"role": item.role, "content": item.content} for item in payload.messages],
            ):
                yield f"data: {json.dumps(chunk, ensure_ascii=False)}\n\n"
        except ValueError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)}, ensure_ascii=False)}\n\n"
        except LlmConfigError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)}, ensure_ascii=False)}\n\n"
        except LlmProviderError as exc:
            yield f"data: {json.dumps({'type': 'error', 'detail': str(exc)}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
