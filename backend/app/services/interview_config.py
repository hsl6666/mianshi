from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from app.models import InterviewFlowConfig
from app.schemas import InterviewFlowConfigRead, InterviewFlowConfigUpdate

GLOBAL_CONFIG_ID = "global"


def get_or_create_interview_config(db: Session) -> InterviewFlowConfig:
    config = db.get(InterviewFlowConfig, GLOBAL_CONFIG_ID)
    if config is not None:
        return config

    config = InterviewFlowConfig(id=GLOBAL_CONFIG_ID, oral_enabled=True)
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_interview_config(db: Session, payload: InterviewFlowConfigUpdate) -> InterviewFlowConfig:
    config = get_or_create_interview_config(db)
    config.oral_enabled = payload.oral_enabled
    db.commit()
    db.refresh(config)
    return config


def interview_config_to_read(config: InterviewFlowConfig) -> InterviewFlowConfigRead:
    return InterviewFlowConfigRead(
        oral_enabled=config.oral_enabled,
        updated_at=config.updated_at if isinstance(config.updated_at, datetime) else datetime.utcnow(),
    )
