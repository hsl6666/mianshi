from __future__ import annotations

from datetime import datetime

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import InterviewFlowConfig
from app.schemas import InterviewFlowConfigRead, InterviewFlowConfigUpdate

GLOBAL_CONFIG_ID = "global"
DEFAULT_ASSISTANT_SYSTEM_PROMPT = (
    "你是面试分析助手。只基于候选人资料、笔试、口试、流程数据、岗位信息和查询结果回答，"
    "不做星座、八字、生肖、血型等招聘判断。"
)
DEFAULT_ASSISTANT_USER_PROMPT = ""


def get_or_create_interview_config(db: Session) -> InterviewFlowConfig:
    ensure_interview_flow_config_columns(db)
    config = db.get(InterviewFlowConfig, GLOBAL_CONFIG_ID)
    if config is not None:
        return config

    config = InterviewFlowConfig(
        id=GLOBAL_CONFIG_ID,
        oral_enabled=True,
        assistant_system_prompt=DEFAULT_ASSISTANT_SYSTEM_PROMPT,
        assistant_user_prompt=DEFAULT_ASSISTANT_USER_PROMPT,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


def update_interview_config(db: Session, payload: InterviewFlowConfigUpdate) -> InterviewFlowConfig:
    config = get_or_create_interview_config(db)
    config.oral_enabled = payload.oral_enabled
    config.assistant_system_prompt = payload.assistant_system_prompt or DEFAULT_ASSISTANT_SYSTEM_PROMPT
    config.assistant_user_prompt = payload.assistant_user_prompt or DEFAULT_ASSISTANT_USER_PROMPT
    db.commit()
    db.refresh(config)
    return config


def interview_config_to_read(config: InterviewFlowConfig) -> InterviewFlowConfigRead:
    return InterviewFlowConfigRead(
        oral_enabled=config.oral_enabled,
        assistant_system_prompt=config.assistant_system_prompt or DEFAULT_ASSISTANT_SYSTEM_PROMPT,
        assistant_user_prompt=config.assistant_user_prompt or DEFAULT_ASSISTANT_USER_PROMPT,
        updated_at=config.updated_at if isinstance(config.updated_at, datetime) else datetime.utcnow(),
    )


def ensure_interview_flow_config_columns(db: Session) -> None:
    if db.bind is None or db.bind.dialect.name != "sqlite":
        return

    existing_columns = {
        row[1]
        for row in db.execute(text("PRAGMA table_info(interview_flow_config)")).fetchall()
    }
    statements: list[str] = []
    if "assistant_system_prompt" not in existing_columns:
        default_value = DEFAULT_ASSISTANT_SYSTEM_PROMPT.replace("'", "''")
        statements.append(
            "ALTER TABLE interview_flow_config "
            f"ADD COLUMN assistant_system_prompt TEXT NOT NULL DEFAULT '{default_value}'"
        )
    if "assistant_user_prompt" not in existing_columns:
        statements.append(
            "ALTER TABLE interview_flow_config "
            "ADD COLUMN assistant_user_prompt TEXT NOT NULL DEFAULT ''"
        )

    if not statements:
        return

    for sql in statements:
        db.execute(text(sql))
    db.commit()
