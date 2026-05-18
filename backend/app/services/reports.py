from datetime import datetime
from typing import Any

from app.models import InterviewSession, Transcript


def build_result_summary(session: InterviewSession) -> dict[str, Any]:
    scores = build_score_breakdown(session)
    profile = session.candidate_profile or {}
    risks = build_risks(session, scores)
    return {
        "session_id": session.id,
        "name": profile.get("name") or "未填写",
        "role": session.role or profile.get("role") or "未填写",
        "phone": profile.get("phone") or "",
        "email": profile.get("email") or "",
        "status": session.status,
        "total_score": scores["total_score"],
        "written_score": scores["written_score"],
        "oral_score": scores["oral_score"],
        "profile_score": scores["profile_score"],
        "risk_level": get_risk_level(scores["total_score"], risks),
        "recommendation": get_recommendation(scores["total_score"], risks),
        "attachments_count": len(session.attachments),
        "snapshots_count": len(session.snapshots),
        "recordings_count": len(session.oral_recordings),
        "qa_count": get_oral_round_count(session),
        "updated_at": session.updated_at.isoformat() if isinstance(session.updated_at, datetime) else str(session.updated_at),
    }


def build_result_detail(session: InterviewSession) -> dict[str, Any]:
    summary = build_result_summary(session)
    scores = build_score_breakdown(session)
    risks = build_risks(session, scores)
    strengths = build_strengths(session, scores)
    qa_pairs = build_qa_pairs(session)
    return {
        "summary": summary,
        "candidate_profile": session.candidate_profile or {},
        "parsed_profile": session.parsed_profile or {},
        "score_breakdown": scores,
        "report": {
            "title": f"{summary['name']} - {summary['role']} 面试成绩分析报告",
            "conclusion": summary["recommendation"],
            "overall_comment": build_overall_comment(summary, strengths, risks),
            "strengths": strengths,
            "risks": risks,
            "dimension_analysis": [
                {
                    "dimension": "基础资料完整度",
                    "score": scores["profile_score"],
                    "comment": "资料越完整，后续追问越能贴近真实经历。",
                },
                {
                    "dimension": "笔试表现",
                    "score": scores["written_score"],
                    "comment": "基于作答覆盖、代码题文本完整度和提交状态进行 MVP 评分。",
                },
                {
                    "dimension": "口试表达",
                    "score": scores["oral_score"],
                    "comment": "基于固定题录音数量、录音时长和流程完成度进行 MVP 评分。",
                },
            ],
            "qa_pairs": qa_pairs,
        },
    }


def build_score_breakdown(session: InterviewSession) -> dict[str, int]:
    profile_score = score_profile(session)
    written_score = score_written(session)
    oral_score = score_oral(session)
    compliance_score = score_compliance(session)
    total = round(profile_score * 0.18 + written_score * 0.34 + oral_score * 0.38 + compliance_score * 0.10)
    return {
        "total_score": min(total, 100),
        "profile_score": profile_score,
        "written_score": written_score,
        "oral_score": oral_score,
        "compliance_score": compliance_score,
    }


def score_profile(session: InterviewSession) -> int:
    profile = session.candidate_profile or {}
    required_fields = ["name", "phone", "email", "role", "school", "major", "degree"]
    filled = sum(1 for key in required_fields if profile.get(key))
    attachment_bonus = 10 if session.attachments else 0
    return min(round(filled / len(required_fields) * 90) + attachment_bonus, 100)


def score_written(session: InterviewSession) -> int:
    submission = session.written_submission or {}
    answers = submission.get("answers") or {}
    if not answers:
        return 0
    non_empty_answers = [value for value in answers.values() if value and value != []]
    score = 45 + min(len(non_empty_answers) * 12, 42)
    code_answers = [str(value) for value in non_empty_answers if isinstance(value, str) and ("function" in value or "return" in value)]
    if any(len(item) > 80 for item in code_answers):
        score += 13
    return min(score, 100)


def score_oral(session: InterviewSession) -> int:
    user_transcripts = [item.text.strip() for item in session.transcripts if item.speaker == "user" and item.text.strip()]
    recordings = list(session.oral_recordings)
    if recordings:
        rounds = len({item.question_index for item in recordings})
        total_seconds = sum(max(item.duration_seconds or 0, 0) for item in recordings)
        score = 36 + min(rounds * 11, 44) + min(total_seconds // 20, 15)
    elif user_transcripts:
        rounds = len(user_transcripts)
        total_chars = sum(len(item) for item in user_transcripts)
        score = 38 + min(rounds * 10, 30) + min(total_chars // 18, 27)
    else:
        return 0
    if session.oral_summary:
        score += 5
    return min(score, 100)


def score_compliance(session: InterviewSession) -> int:
    score = 60
    if session.attachments:
        score += 15
    if session.oral_recordings or session.snapshots:
        score += 15
    if session.status == "completed":
        score += 10
    return min(score, 100)


def build_strengths(session: InterviewSession, scores: dict[str, int]) -> list[str]:
    strengths: list[str] = []
    if scores["written_score"] >= 80:
        strengths.append("笔试作答覆盖度较高，具备继续技术追问的基础。")
    if scores["oral_score"] >= 80:
        strengths.append("口试回答留存较完整，能支撑后续人工复核。")
    if session.attachments:
        strengths.append("已提交附件资料，便于结合简历进行结构化核验。")
    if session.oral_recordings:
        strengths.append("口试录音文件已保存，便于复听核验候选人表达。")
    if not strengths:
        strengths.append("已完成基础流程，可作为初筛记录进入人工复核。")
    return strengths


def build_risks(session: InterviewSession, scores: dict[str, int]) -> list[str]:
    risks: list[str] = []
    if scores["written_score"] < 60:
        risks.append("笔试提交信息不足，建议人工复核代码题和简答题质量。")
    if scores["oral_score"] < 60:
        risks.append("口试录音数量或时长不足，暂不能充分判断表达与项目深度。")
    if not session.attachments:
        risks.append("未上传简历或附件，简历结构化信息缺失。")
    if session.status in {"draft", "written_submitted", "oral_started"}:
        risks.append("流程尚未完整结束，当前报告只能作为阶段性结果。")
    if not session.oral_recordings and not session.transcripts and session.status in {"oral_started", "completed"}:
        risks.append("口试未留存回答材料，需补充录音或人工记录。")
    return risks


def get_oral_round_count(session: InterviewSession) -> int:
    summary_qa = (session.oral_summary or {}).get("qa") if isinstance(session.oral_summary, dict) else None
    if isinstance(summary_qa, list) and summary_qa:
        return len(summary_qa)
    if session.oral_recordings:
        return len({item.question_index for item in session.oral_recordings})
    return len([item for item in session.transcripts if item.speaker == "user"])


def build_qa_pairs(session: InterviewSession) -> list[dict[str, Any]]:
    summary_qa = (session.oral_summary or {}).get("qa") if isinstance(session.oral_summary, dict) else None
    if isinstance(summary_qa, list) and summary_qa:
        pairs: list[dict[str, Any]] = []
        for item in summary_qa:
            if not isinstance(item, dict):
                continue
            pairs.append(
                {
                    "question": str(item.get("question") or ""),
                    "answer": str(item.get("answer") or item.get("filename") or "已上传录音文件"),
                    "audio_url": str(item.get("audio_url") or ""),
                    "duration_seconds": int(item.get("duration_seconds") or 0),
                    "at": str(item.get("at") or ""),
                }
            )
        return pairs

    if session.oral_recordings:
        return [
            {
                "question": item.question_text,
                "answer": item.filename,
                "audio_url": item.url,
                "duration_seconds": item.duration_seconds,
                "at": item.created_at.isoformat() if isinstance(item.created_at, datetime) else str(item.created_at),
            }
            for item in session.oral_recordings
        ]

    transcripts: list[Transcript] = list(session.transcripts)
    pairs: list[dict[str, str]] = []
    pending_question = ""
    for item in transcripts:
        if item.speaker == "assistant":
            pending_question = item.text
        elif item.speaker == "user":
            pairs.append(
                {
                    "question": pending_question,
                    "answer": item.text,
                    "at": item.created_at.isoformat() if isinstance(item.created_at, datetime) else str(item.created_at),
                }
            )
            pending_question = ""
    return pairs


def get_risk_level(total_score: int, risks: list[str]) -> str:
    if total_score >= 82 and len(risks) <= 1:
        return "low"
    if total_score >= 65:
        return "medium"
    return "high"


def get_recommendation(total_score: int, risks: list[str]) -> str:
    if total_score >= 86 and len(risks) <= 1:
        return "建议进入技术复面"
    if total_score >= 72:
        return "建议人工复核后安排复面"
    if total_score >= 58:
        return "谨慎推进，需补充验证"
    return "暂不建议进入下一轮"


def build_overall_comment(summary: dict[str, Any], strengths: list[str], risks: list[str]) -> str:
    risk_text = "；".join(risks[:2]) if risks else "暂无明显流程风险"
    return (
        f"候选人综合得分 {summary['total_score']}，当前建议为“{summary['recommendation']}”。"
        f"主要优势：{strengths[0]} 主要风险：{risk_text}。"
    )
