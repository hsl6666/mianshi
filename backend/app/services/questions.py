from app.schemas import Question, QuestionOption


def _common_questions(role: str) -> list[Question]:
    return [
        Question(
            id="q-single-architecture",
            title="系统拆解能力",
            type="single",
            prompt=f"当你接到一个新的{role or '技术'}需求时，第一步最应该确认什么？",
            options=[
                QuestionOption(label="直接开始写核心代码", value="code_first"),
                QuestionOption(label="确认目标、边界、验收标准和风险", value="scope_first"),
                QuestionOption(label="先选最新技术栈", value="tech_first"),
                QuestionOption(label="等需求完全稳定再启动", value="wait"),
            ],
        ),
        Question(
            id="q-multi-quality",
            title="工程质量判断",
            type="multi",
            prompt="以下哪些属于生产级交付前应重点检查的事项？",
            options=[
                QuestionOption(label="关键路径测试", value="tests"),
                QuestionOption(label="日志与错误处理", value="observability"),
                QuestionOption(label="敏感配置硬编码", value="hardcode_secret"),
                QuestionOption(label="数据模型迁移策略", value="migration"),
            ],
        ),
        Question(
            id="q-short-project",
            title="项目复盘",
            type="short",
            prompt="描述一个你主导或深度参与的项目，说明你的职责、关键难点、取舍和最终结果。",
        ),
    ]


def get_questions_for_role(role: str) -> list[Question]:
    normalized = role.lower()
    questions = _common_questions(role)

    if any(key in normalized for key in ["ai", "算法", "大模型", "llm"]):
        questions.append(
            Question(
                id="q-code-ai-ranking",
                title="代码题：候选回复排序",
                type="code",
                prompt="实现 rankAnswers(items)，按 score 降序排序；score 相同按 createdAt 升序；返回 id 数组。",
                language="typescript",
                starter_code=(
                    "type Item = { id: string; score: number; createdAt: string };\n\n"
                    "export function rankAnswers(items: Item[]): string[] {\n"
                    "  // TODO: 按 score 降序，score 相同按 createdAt 升序\n"
                    "  return [];\n"
                    "}\n"
                ),
            )
        )
        return questions

    if any(key in normalized for key in ["前端", "frontend", "react"]):
        questions.append(
            Question(
                id="q-code-frontend",
                title="代码题：防抖函数",
                type="code",
                prompt="实现 debounce(fn, wait)，连续触发时只执行最后一次调用。",
                language="typescript",
                starter_code=(
                    "export function debounce<T extends (...args: any[]) => void>(fn: T, wait: number) {\n"
                    "  // TODO: 返回一个防抖后的函数\n"
                    "}\n"
                ),
            )
        )
        return questions

    questions.append(
        Question(
            id="q-code-open",
            title="代码题：合并区间",
            type="code",
            prompt="给定若干闭区间，合并所有重叠区间并按起点升序返回。",
            language="typescript",
            starter_code=(
                "export function mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {\n"
                "  // TODO: 合并重叠区间\n"
                "  return [];\n"
                "}\n"
            ),
        )
    )
    return questions
