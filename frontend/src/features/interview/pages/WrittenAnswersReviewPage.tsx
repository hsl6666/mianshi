import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Empty, Spin, Tag, Typography, message } from "antd";
import { PrinterOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { fetchQuestions, fetchSession } from "../api";
import { InterviewShell } from "../components/InterviewShell";
import type { InterviewSession, Question, WrittenAnswers } from "../types";

const questionTypeLabels: Record<Question["type"], string> = {
  single: "单选题",
  multi: "多选题",
  short: "简答题",
  code: "代码题",
};

export default function WrittenAnswersReviewPage() {
  const [searchParams] = useSearchParams();
  const sessionId = useMemo(() => searchParams.get("sessionId")?.trim() || "", [searchParams]);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      message.error("缺少候选人 sessionId，无法加载笔试作答");
      return;
    }

    let ignore = false;
    setLoading(true);
    fetchSession(sessionId)
      .then(async (nextSession) => {
        if (ignore) return;
        setSession(nextSession);
        try {
          const role = nextSession.role || String(nextSession.candidate_profile.role || "");
          const nextQuestions = await fetchQuestions(role);
          if (!ignore) setQuestions(nextQuestions);
        } catch {
          if (!ignore) message.warning("题目列表加载失败，将仅展示已提交的作答内容");
        }
      })
      .catch(() => {
        if (ignore) return;
        setSession(null);
        message.error("加载笔试作答失败，请确认后端服务可用");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [sessionId]);

  const answers = useMemo(() => getWrittenAnswers(session), [session]);
  const answerEntries = Object.entries(answers);
  const answeredIds = useMemo(() => new Set(answerEntries.map(([questionId]) => questionId)), [answerEntries]);
  const knownQuestionIds = useMemo(() => new Set(questions.map((question) => question.id)), [questions]);
  const orphanAnswers = answerEntries.filter(([questionId]) => !knownQuestionIds.has(questionId));
  const submittedAt = getStringField(session?.written_submission, "submitted_at");
  const durationSeconds = getNumberField(session?.written_submission, "duration_seconds");

  return (
    <InterviewShell current="done" title="笔试作答查看" description="查看候选人已提交的笔试题目和对应作答内容。">
      {loading ? (
        <div className="flex h-80 items-center justify-center rounded-xl border border-stone-200 bg-white">
          <Spin tip="加载笔试作答中..." />
        </div>
      ) : session ? (
        <div className="space-y-5">
          <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Typography.Title level={3} className="!mb-1">
                  {String(session.candidate_profile.name || "未填写")}
                </Typography.Title>
                <p className="text-sm text-stone-500">{session.role || String(session.candidate_profile.role || "未填写")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Tag color={answerEntries.length ? "green" : "default"}>{answerEntries.length} 题已作答</Tag>
                {submittedAt ? <Tag>{dayjs(submittedAt).format("YYYY-MM-DD HH:mm")}</Tag> : null}
                {durationSeconds ? <Tag>{formatDuration(durationSeconds)}</Tag> : null}
                <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                  打印
                </Button>
              </div>
            </div>
          </section>

          {answerEntries.length ? (
            <section className="space-y-4">
              {questions.map((question, index) => (
                <WrittenAnswerCard
                  key={question.id}
                  index={index}
                  question={question}
                  answer={answers[question.id]}
                  answered={answeredIds.has(question.id)}
                />
              ))}

              {orphanAnswers.map(([questionId, answer], index) => (
                <section key={questionId} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Tag>{questions.length + index + 1}</Tag>
                    <Tag color="orange">历史题目</Tag>
                    <span className="text-sm font-semibold text-stone-950">{questionId}</span>
                  </div>
                  <AnswerValue value={answer} />
                </section>
              ))}
            </section>
          ) : (
            <Empty description="暂无笔试作答内容" />
          )}
        </div>
      ) : (
        <Empty description="暂无笔试作答内容" />
      )}
    </InterviewShell>
  );
}

function WrittenAnswerCard({
  index,
  question,
  answer,
  answered,
}: {
  index: number;
  question: Question;
  answer: WrittenAnswers[string] | undefined;
  answered: boolean;
}) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Tag>{index + 1}</Tag>
        <Tag color="blue">{questionTypeLabels[question.type]}</Tag>
        <Tag color={answered ? "green" : "default"}>{answered ? "已作答" : "未作答"}</Tag>
      </div>
      <h2 className="text-lg font-semibold text-stone-950">{question.title}</h2>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-600">{question.prompt}</p>

      {question.options.length ? (
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {question.options.map((option) => {
            const selected = isOptionSelected(answer, option.value);
            return (
              <div
                key={option.value}
                className={`rounded-lg border px-3 py-2 text-sm ${
                  selected ? "border-emerald-700 bg-emerald-50 text-emerald-950" : "border-stone-200 bg-stone-50 text-stone-600"
                }`}
              >
                <span className="font-semibold">{option.value}.</span> {option.label}
              </div>
            );
          })}
        </div>
      ) : null}

      <div className="mt-5 border-t border-stone-200 pt-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Answer</div>
        <AnswerValue value={answer} />
      </div>
    </section>
  );
}

function AnswerValue({ value }: { value: WrittenAnswers[string] | undefined }) {
  if (Array.isArray(value)) {
    return value.length ? (
      <div className="flex flex-wrap gap-2">
        {value.map((item) => (
          <Tag key={item} color="green">
            {item}
          </Tag>
        ))}
      </div>
    ) : (
      <span className="text-sm text-stone-400">未填写</span>
    );
  }

  if (!value) return <span className="text-sm text-stone-400">未填写</span>;

  return (
    <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-lg bg-stone-950 p-4 text-sm leading-6 text-stone-50">
      {value}
    </pre>
  );
}

function getWrittenAnswers(session: InterviewSession | null): WrittenAnswers {
  const answers = session?.written_submission.answers;
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return {};
  return Object.entries(answers).reduce<WrittenAnswers>((items, [key, value]) => {
    if (typeof value === "string") {
      items[key] = value;
    } else if (Array.isArray(value)) {
      items[key] = value.map(String);
    }
    return items;
  }, {});
}

function isOptionSelected(answer: WrittenAnswers[string] | undefined, optionValue: string) {
  if (Array.isArray(answer)) return answer.includes(optionValue);
  return answer === optionValue;
}

function getStringField(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" ? value : "";
}

function getNumberField(source: Record<string, unknown> | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "number" ? value : 0;
}

function formatDuration(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}
