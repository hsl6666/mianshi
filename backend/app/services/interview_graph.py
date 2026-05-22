from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.services.llm_config import chat_completion


STAGES = ["intro", "project_deep_dive", "logic", "behavior", "closing"]


@dataclass
class InterviewInput:
    role: str
    resume_summary: str
    conversation_history: list[dict[str, str]]


def build_role_card(tone: str = "friendly") -> str:
    style = "友好、克制、追问具体事实" if tone == "friendly" else "严格、直接、重视证据链"
    return (
        "你是一个 AI 技术面试官。"
        f"面试风格：{style}。"
        "你必须围绕候选人的岗位、简历摘要、笔试表现和前序回答推进，"
        "每次只提出一个清晰问题，避免长篇说教。"
    )


async def generate_interview_reply(payload: InterviewInput, db: Session) -> tuple[str, str]:
    stage = _pick_stage(len([item for item in payload.conversation_history if item.get("speaker") == "assistant"]))
    fallback = _fallback_reply(stage, payload.role, payload.resume_summary)

    prompt = _build_prompt(stage, payload)
    try:
        text = await chat_completion(
            db,
            messages=[
                {"role": "system", "content": build_role_card()},
                {"role": "user", "content": prompt},
            ],
            temperature=0.6,
            timeout=30,
        )
        return text or fallback, stage
    except Exception:
        return fallback, stage


def get_graph_description() -> dict:
    try:
        from langgraph.graph import END, StateGraph

        graph = StateGraph(dict)
        for stage in STAGES:
            graph.add_node(stage, lambda state, current_stage=stage: {**state, "stage": current_stage})
        graph.set_entry_point("intro")
        graph.add_edge("intro", "project_deep_dive")
        graph.add_edge("project_deep_dive", "logic")
        graph.add_edge("logic", "behavior")
        graph.add_edge("behavior", "closing")
        graph.add_edge("closing", END)
        graph.compile()
        return {"enabled": True, "nodes": STAGES}
    except Exception:
        return {"enabled": False, "nodes": STAGES, "reason": "langgraph is optional until dependencies are installed"}


def _pick_stage(assistant_count: int) -> str:
    if assistant_count <= 0:
        return "intro"
    if assistant_count == 1:
        return "project_deep_dive"
    if assistant_count == 2:
        return "logic"
    if assistant_count == 3:
        return "behavior"
    return "closing"


def _fallback_reply(stage: str, role: str, resume_summary: str) -> str:
    role_text = role or "目标岗位"
    summary_hint = resume_summary[:120] if resume_summary else "你刚才提交的基础信息"
    replies = {
        "intro": f"你好，我是本轮 {role_text} 的 AI 面试官。接下来我会结合简历和笔试回答追问，请先用一分钟介绍你最近最能代表能力的项目。",
        "project_deep_dive": f"我看到你的资料里提到：{summary_hint}。请具体说明这个项目里最困难的技术问题、你的方案以及最终指标变化。",
        "logic": "现在做一道逻辑题：如果线上接口 P95 延迟突然从 200ms 升到 2s，你会如何从监控、日志、依赖和代码变更四个方向定位？请按优先级回答。",
        "behavior": "请用 STAR 结构讲一次你和产品、算法或后端同学出现明显分歧的经历，重点说明你如何推进决策。",
        "closing": "最后一个问题：如果入职后第一个月只能完成一件最能证明你价值的事，你会选择什么，为什么？",
    }
    return replies[stage]


def _build_prompt(stage: str, payload: InterviewInput) -> str:
    history = "\n".join(f"{item.get('speaker')}: {item.get('text')}" for item in payload.conversation_history[-12:])
    return (
        f"当前节点：{stage}\n"
        f"岗位：{payload.role or '未填写'}\n"
        f"简历摘要：{payload.resume_summary or '暂无'}\n"
        f"历史对话：\n{history or '暂无'}\n"
        "请生成下一句面试官提问。"
    )
