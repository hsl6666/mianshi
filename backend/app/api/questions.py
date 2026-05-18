from fastapi import APIRouter

from app.schemas import Question
from app.services.questions import get_questions_for_role

router = APIRouter(tags=["questions"])


@router.get("/api/questions", response_model=list[Question])
def questions(role: str = "") -> list[Question]:
    return get_questions_for_role(role)
