from __future__ import annotations

from uuid import uuid4

from sqlalchemy.orm import Session

from app.models import JobPosition
from app.schemas import JobPositionCreate, JobPositionUpdate

DEFAULT_POSITIONS = [
    ("AI应用开发工程师", "负责 AI 应用与智能体相关研发", 10),
    ("前端工程师", "负责 Web 前端开发与交互实现", 20),
    ("通用", "未指定岗位时的通用题库", 99),
]


def ensure_seed_positions(db: Session) -> None:
    if db.query(JobPosition).count():
        return
    for name, description, sort_order in DEFAULT_POSITIONS:
        db.add(
            JobPosition(
                id=uuid4().hex,
                name=name,
                description=description,
                enabled=True,
                sort_order=sort_order,
            )
        )
    db.commit()


def list_positions(db: Session, *, enabled_only: bool = False) -> list[JobPosition]:
    ensure_seed_positions(db)
    query = db.query(JobPosition)
    if enabled_only:
        query = query.filter(JobPosition.enabled.is_(True))
    return query.order_by(JobPosition.sort_order.asc(), JobPosition.created_at.asc()).all()


def create_position(db: Session, payload: JobPositionCreate) -> JobPosition:
    existing = db.query(JobPosition).filter(JobPosition.name == payload.name.strip()).first()
    if existing:
        raise ValueError("岗位名称已存在")
    position = JobPosition(
        id=uuid4().hex,
        name=payload.name.strip(),
        description=(payload.description or "").strip(),
        enabled=payload.enabled,
        sort_order=payload.sort_order,
    )
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


def update_position(db: Session, position_id: str, payload: JobPositionUpdate) -> JobPosition | None:
    position = db.get(JobPosition, position_id)
    if position is None:
        return None
    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        normalized = data["name"].strip()
        conflict = (
            db.query(JobPosition)
            .filter(JobPosition.name == normalized, JobPosition.id != position_id)
            .first()
        )
        if conflict:
            raise ValueError("岗位名称已存在")
        data["name"] = normalized
    if "description" in data and data["description"] is not None:
        data["description"] = data["description"].strip()
    for key, value in data.items():
        setattr(position, key, value)
    db.commit()
    db.refresh(position)
    return position


def delete_position(db: Session, position_id: str) -> bool:
    position = db.get(JobPosition, position_id)
    if position is None:
        return False
    db.delete(position)
    db.commit()
    return True
