from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.models import InterviewSession
from app.services.llm_config import LlmConfigError, LlmProviderError, chat_completion
from app.services.reports import build_result_detail, build_result_summary

SENSITIVE_KEYWORDS = (
    "生辰八字",
    "八字",
    "星座",
    "生肖",
    "属相",
    "血型",
    "算命",
    "运势",
    "玄学",
    "看相",
    "匹配员工",
)

FORBIDDEN_SQL_PATTERNS = (
    r"\binsert\b",
    r"\bupdate\b",
    r"\bdelete\b",
    r"\bdrop\b",
    r"\balter\b",
    r"\bcreate\b",
    r"\breplace\b",
    r"\bpragma\b",
    r"\battach\b",
    r"\bdetach\b",
    r"\bvacuum\b",
    r"\btruncate\b",
)
ALL_CANDIDATES_SESSION_ID = "__all__"


async def answer_interview_question(db: Session, session_id: str, messages: list[dict[str, str]]) -> dict[str, str]:
    user_question = _latest_user_question(messages)
    if not user_question:
        return {"answer": "请输入你要分析的问题。", "sql_used": "", "warning": ""}

    blocked_reason = _blocked_reason(user_question)
    if blocked_reason:
        return {"answer": blocked_reason, "sql_used": "", "warning": "sensitive_request_blocked"}

    sessions = db.query(InterviewSession).order_by(InterviewSession.updated_at.desc()).all()
    all_summaries = [build_result_summary(item) for item in sessions]
    if not all_summaries:
        return {"answer": "当前没有候选人数据，暂时无法分析。", "sql_used": "", "warning": ""}

    candidate_detail: dict[str, Any] | None = None
    if session_id != ALL_CANDIDATES_SESSION_ID:
        session = db.get(InterviewSession, session_id)
        if session is None:
            return {"answer": "未找到当前候选人数据，请先选择有效候选人。", "sql_used": "", "warning": ""}
        candidate_detail = build_result_detail(session)

    planner_prompt = _build_planner_prompt(candidate_detail, all_summaries, messages)

    raw_plan = await _ask_model(db, planner_prompt)
    plan = _parse_plan(raw_plan)
    sql_used = ""

    if plan.get("mode") == "sql":
        sql = str(plan.get("sql") or "").strip()
        safe_sql = _validate_sql(sql)
        rows = _run_query(db, safe_sql)
        sql_used = safe_sql
        analyst_prompt = _build_analyst_prompt(candidate_detail, all_summaries, messages, safe_sql, rows)
        answer = await _ask_model(db, analyst_prompt)
        return {"answer": answer.strip(), "sql_used": sql_used, "warning": ""}

    direct_answer = str(plan.get("answer") or "").strip()
    if direct_answer:
        return {"answer": direct_answer, "sql_used": "", "warning": ""}

    fallback_prompt = _build_fallback_prompt(candidate_detail, all_summaries, messages)
    answer = await _ask_model(db, fallback_prompt)
    return {"answer": answer.strip(), "sql_used": "", "warning": ""}


async def _ask_model(db: Session, prompt: str) -> str:
    content = await chat_completion(
        db,
        messages=[
            {
                "role": "system",
                "content": "你是招聘分析助手。只基于候选人资料、笔试、口试、流程数据、岗位信息和查询结果回答，不做星座、八字、生肖、血型等招聘判断。",
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        timeout=45,
        require_config=True,
    )
    return (content or "").strip()


def _latest_user_question(messages: list[dict[str, str]]) -> str:
    for item in reversed(messages):
        if item.get("role") == "user" and item.get("content", "").strip():
            return item["content"].strip()
    return ""


def _blocked_reason(question: str) -> str:
    lowered = question.lower()
    if any(keyword in question for keyword in SENSITIVE_KEYWORDS):
        return "这个助手不能根据生辰八字、星座、生肖、血型或类似信息来筛选、匹配或评价候选人。你可以改问岗位匹配度、笔试口试表现、项目经历、学历、工作年限、技能关键词等与招聘直接相关的信息。"
    if "身份证" in question and ("匹配" in question or "筛选" in question or "推荐" in question):
        return "这个助手不能基于身份证信息做招聘匹配或筛选。可以改用岗位、成绩、经历、技能、学历和项目方向等招聘相关字段做分析。"
    if "年龄" in question and ("匹配" in question or "筛选" in question or "淘汰" in question):
        return "这个助手不能基于年龄做招聘筛选或推荐。可以改问技能、项目经历、成绩和岗位匹配度。"
    return ""


def _build_planner_prompt(
    candidate_detail: dict[str, Any] | None,
    all_summaries: list[dict[str, Any]],
    messages: list[dict[str, str]],
) -> str:
    return f"""
请你决定是直接回答，还是先生成 SQL 查询再回答。

规则：
1. 只能做与招聘直接相关的分析。
2. 禁止基于星座、八字、生肖、血型、宗教、民族、婚育、身份证推断等做判断。
3. 如果需要 SQL，只能生成单条只读查询，且必须是 SELECT 或 WITH 开头。
4. 优先查询以下表：sessions, attachments, transcripts, interview_snapshots, oral_recordings, written_questions, oral_questions, job_positions。
5. SQLite JSON 字段：
   - sessions.candidate_profile
   - sessions.parsed_profile
   - sessions.written_submission
   - sessions.oral_summary
6. 常用字段示例：
   - sessions.id, sessions.role, sessions.status, sessions.created_at, sessions.updated_at
   - json_extract(sessions.candidate_profile, '$.name')
   - json_extract(sessions.candidate_profile, '$.phone')
   - json_extract(sessions.candidate_profile, '$.school')
   - json_extract(sessions.candidate_profile, '$.major')
   - json_extract(sessions.candidate_profile, '$.degree')

当前候选人详情：
{json.dumps(candidate_detail, ensure_ascii=False) if candidate_detail else "当前模式为全部候选人，没有单个候选人上下文。"}

候选人结果摘要列表：
{json.dumps(all_summaries[:50], ensure_ascii=False)}

对话历史：
{json.dumps(messages[-12:], ensure_ascii=False)}

请仅输出 JSON，不要加 markdown：
{{
  "mode": "answer" 或 "sql",
  "answer": "当 mode=answer 时给出完整中文回答，否则为空字符串",
  "sql": "当 mode=sql 时给出 SQL，否则为空字符串",
  "reason": "一句话说明为什么这么做"
}}
""".strip()


def _build_analyst_prompt(
    candidate_detail: dict[str, Any] | None,
    all_summaries: list[dict[str, Any]],
    messages: list[dict[str, str]],
    sql: str,
    rows: list[dict[str, Any]],
) -> str:
    return f"""
你是招聘分析助手。请基于当前候选人详情、全局候选人摘要、用户问题和 SQL 查询结果进行回答。

要求：
1. 只做招聘直接相关分析。
2. 回答要明确引用查询结果中的关键信息。
3. 如果查询结果不足以支持明确结论，要直接说不足，不要硬编。
4. 不要提星座、八字、生肖、血型之类内容。

当前候选人详情：
{json.dumps(candidate_detail, ensure_ascii=False) if candidate_detail else "当前模式为全部候选人，没有单个候选人上下文。"}

候选人结果摘要列表：
{json.dumps(all_summaries[:50], ensure_ascii=False)}

最近对话：
{json.dumps(messages[-12:], ensure_ascii=False)}

执行 SQL：
{sql}

SQL 结果：
{json.dumps(rows, ensure_ascii=False)}

请直接输出中文回答。
""".strip()


def _build_fallback_prompt(
    candidate_detail: dict[str, Any] | None,
    all_summaries: list[dict[str, Any]],
    messages: list[dict[str, str]],
) -> str:
    return f"""
你是招聘分析助手。请仅根据当前候选人详情、全局候选人摘要和对话历史，直接回答用户问题。
如果信息不足，明确指出缺少什么数据。

当前候选人详情：
{json.dumps(candidate_detail, ensure_ascii=False) if candidate_detail else "当前模式为全部候选人，没有单个候选人上下文。"}

候选人结果摘要列表：
{json.dumps(all_summaries[:50], ensure_ascii=False)}

最近对话：
{json.dumps(messages[-12:], ensure_ascii=False)}

请直接输出中文回答。
""".strip()


def _parse_plan(raw: str) -> dict[str, Any]:
    content = raw.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*", "", content)
        content = re.sub(r"\s*```$", "", content)
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    return {"mode": "answer", "answer": raw.strip(), "sql": "", "reason": "model_output_not_json"}


def _validate_sql(sql: str) -> str:
    normalized = sql.strip().rstrip(";").strip()
    lowered = normalized.lower()
    if not normalized:
        raise ValueError("模型未生成有效 SQL")
    if not (lowered.startswith("select") or lowered.startswith("with")):
        raise ValueError("只允许执行 SELECT 查询")
    if ";" in normalized:
        raise ValueError("只允许执行单条 SQL 查询")
    for pattern in FORBIDDEN_SQL_PATTERNS:
        if re.search(pattern, lowered):
            raise ValueError("SQL 包含不允许的语句")
    return normalized


def _run_query(db: Session, sql: str) -> list[dict[str, Any]]:
    result = db.execute(text(sql))
    keys = list(result.keys())
    rows = result.fetchmany(50)
    items: list[dict[str, Any]] = []
    for row in rows:
        values = dict(zip(keys, row))
        items.append({key: _normalize_value(value) for key, value in values.items()})
    return items


def _normalize_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)
