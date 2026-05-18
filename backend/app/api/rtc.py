from fastapi import APIRouter, HTTPException

from app.schemas import RtcAnswer, RtcOffer
from app.services.interview_graph import get_graph_description
from app.services.rtc import RtcUnavailableError, create_rtc_answer

router = APIRouter(tags=["rtc"])


@router.post("/api/rtc/offer", response_model=RtcAnswer)
async def rtc_offer(payload: RtcOffer) -> RtcAnswer:
    try:
        answer = await create_rtc_answer(payload.sdp, payload.type)
        return RtcAnswer(**answer)
    except RtcUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.get("/api/interview-graph")
def graph_status() -> dict:
    return get_graph_description()
