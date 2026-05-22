from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import JobPositionCreate, JobPositionRead, JobPositionUpdate
from app.services.positions import create_position, delete_position, list_positions, update_position

router = APIRouter(tags=["positions"])


@router.get("/api/positions", response_model=list[JobPositionRead])
def public_list_positions(db: Session = Depends(get_db)) -> list:
    return list_positions(db, enabled_only=True)


@router.get("/api/admin/positions", response_model=list[JobPositionRead])
def admin_list_positions(db: Session = Depends(get_db)) -> list:
    return list_positions(db)


@router.post("/api/admin/positions", response_model=JobPositionRead)
def admin_create_position(payload: JobPositionCreate, db: Session = Depends(get_db)):
    try:
        return create_position(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.patch("/api/admin/positions/{position_id}", response_model=JobPositionRead)
def admin_update_position(position_id: str, payload: JobPositionUpdate, db: Session = Depends(get_db)):
    try:
        position = update_position(db, position_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if position is None:
        raise HTTPException(status_code=404, detail="position not found")
    return position


@router.delete("/api/admin/positions/{position_id}")
def admin_delete_position(position_id: str, db: Session = Depends(get_db)) -> dict[str, bool]:
    deleted = delete_position(db, position_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="position not found")
    return {"ok": True}
