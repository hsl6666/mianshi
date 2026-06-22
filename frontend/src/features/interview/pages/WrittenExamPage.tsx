import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { Alert, Button, Checkbox, Input, Modal, Radio, Spin, Tag, message } from "antd";
import { SafetyCertificateOutlined, SendOutlined } from "@ant-design/icons";
import { fetchQuestions, fetchSession, submitWrittenExam } from "../api";
import { InterviewShell } from "../components/InterviewShell";
import { getInterviewSessionId, loadAnswers, saveAnswers } from "../storage";
import type { InterviewSession, Question, WrittenAnswers, WrittenExamSubmission } from "../types";

const { TextArea } = Input;
const EXAM_SECONDS = Number(import.meta.env.VITE_WRITTEN_EXAM_SECONDS || 30 * 60);
const RULE_READING_SECONDS = 10;

export default function WrittenExamPage() {
  const navigate = useNavigate();
  const sessionId = useMemo(() => getInterviewSessionId(), []);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<WrittenAnswers>(() => loadAnswers(sessionId));
  const [remaining, setRemaining] = useState(EXAM_SECONDS);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [ruleReadingRemaining, setRuleReadingRemaining] = useState(RULE_READING_SECONDS);
  const [examStarted, setExamStarted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fiveMinuteAlert, setFiveMinuteAlert] = useState(false);
  const submittedRef = useRef(false);

  useEffect(() => {
    fetchSession(sessionId)
      .then((data) => {
        setSession(data);
        return fetchQuestions(data.role || String(data.candidate_profile.role || ""));
      })
      .then(setQuestions)
      .catch(() => message.error("无法加载笔试题，请确认后端已启动"));
  }, [sessionId]);

  const doSubmit = useCallback(async () => {
    if (submittedRef.current || !examStarted) return;
    submittedRef.current = true;
    setSubmitting(true);
    const payload: WrittenExamSubmission = {
      session_id: sessionId,
      role: session?.role || String(session?.candidate_profile.role || ""),
      started_at: startedAt || new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      duration_seconds: EXAM_SECONDS - remaining,
      answers,
    };
    saveAnswers(sessionId, answers);
    console.log(`提交的试卷为：${JSON.stringify(payload)}`);
    try {
      await submitWrittenExam(sessionId, payload);
      navigate("/interview/oral");
    } catch {
      submittedRef.current = false;
      message.error("提交失败，请确认后端服务可用");
    } finally {
      setSubmitting(false);
    }
  }, [answers, examStarted, navigate, remaining, session, sessionId, startedAt]);

  useEffect(() => {
    if (examStarted) return;
    const timer = window.setInterval(() => {
      setRuleReadingRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [examStarted]);

  useEffect(() => {
    if (!examStarted) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => {
        if (value <= 1) {
          window.clearInterval(timer);
          void doSubmit();
          return 0;
        }
        if (value === 5 * 60) {
          setFiveMinuteAlert(true);
          window.setTimeout(() => setFiveMinuteAlert(false), 5000);
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [doSubmit, examStarted]);

  function updateAnswer(questionId: string, value: string | string[]) {
    const next = { ...answers, [questionId]: value };
    setAnswers(next);
    saveAnswers(sessionId, next);
  }

  function startExam() {
    setStartedAt(new Date().toISOString());
    setExamStarted(true);
  }

  return (
    <InterviewShell current="written" title="技术笔试" description="题目会根据岗位生成，包含选择题、简答题和至少一道代码题。时间结束后系统会自动提交。">
      <Modal
        centered
        closable={false}
        footer={[
          <Button key="confirm" type="primary" size="large" disabled={ruleReadingRemaining > 0} onClick={startExam}>
            {ruleReadingRemaining > 0 ? `${ruleReadingRemaining}s 后可点击已阅` : "已阅，开始答题"}
          </Button>,
        ]}
        keyboard={false}
        maskClosable={false}
        open={!examStarted}
        title={
          <div className="flex items-center gap-2">
            <SafetyCertificateOutlined className="text-amber-600" />
            <span>笔试规则确认</span>
          </div>
        }
      >
        <div className="space-y-4 text-sm leading-6 text-stone-700">
          <p>请面试人员诚信答题，请勿使用答案搜寻工具或通过其他页面搜索答案。</p>
          <p>系统内已开启屏幕监控，请勿切换至其他页面查找答案或进行与笔试无关的操作。</p>
          <p>本次面试的核心目的是了解当前能力和岗位匹配情况，并无其他意图。请遵循规则，独立完成答题。</p>
          <Alert type="warning" showIcon message="请阅读 10 秒后点击“已阅，开始答题”，届时将正式进入答题环节并开始计时。" />
        </div>
      </Modal>

      {fiveMinuteAlert ? <Alert type="warning" showIcon message="距离笔试结束还有 5 分钟，请尽快检查答案。" /> : null}
      {remaining <= 30 ? <div className="pointer-events-none fixed inset-0 z-50 animate-[examFlash_.8s_ease-in-out_infinite] bg-red-500/10" /> : null}

      <div className="sticky top-0 z-20 flex items-center justify-between rounded-xl border border-stone-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Written Exam</p>
          <h2 className="mt-1 text-lg font-semibold text-stone-950">{session?.role || "技术岗位"} 笔试题</h2>
        </div>
        <Tag color={remaining <= 30 ? "red" : remaining <= 300 ? "orange" : "green"} className="px-4 py-2 text-base">
          {formatTime(remaining)}
        </Tag>
      </div>

      {questions.length === 0 ? (
        <div className="flex h-80 items-center justify-center rounded-xl border border-stone-200 bg-white">
          <Spin tip="加载题目中..." />
        </div>
      ) : (
        <div className="space-y-5">
          {questions.map((question, index) => (
            <section key={question.id} className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <Tag>{index + 1}</Tag>
                <h3 className="text-lg font-semibold text-stone-950">{question.title}</h3>
                <Tag color="blue">{question.type}</Tag>
              </div>
              <p className="mb-5 text-sm leading-6 text-stone-600">{question.prompt}</p>
              {question.type === "single" ? (
                <Radio.Group value={answers[question.id]} onChange={(event) => updateAnswer(question.id, event.target.value)}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {question.options.map((option) => (
                      <Radio key={option.value} value={option.value} className="rounded-lg border border-stone-200 p-3">
                        {option.label}
                      </Radio>
                    ))}
                  </div>
                </Radio.Group>
              ) : null}
              {question.type === "multi" ? (
                <Checkbox.Group value={(answers[question.id] as string[]) || []} onChange={(value) => updateAnswer(question.id, value as string[])}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {question.options.map((option) => (
                      <Checkbox key={option.value} value={option.value} className="rounded-lg border border-stone-200 p-3">
                        {option.label}
                      </Checkbox>
                    ))}
                  </div>
                </Checkbox.Group>
              ) : null}
              {question.type === "short" ? (
                <TextArea rows={5} value={String(answers[question.id] || "")} onChange={(event) => updateAnswer(question.id, event.target.value)} />
              ) : null}
              {question.type === "code" ? (
                <div className="overflow-hidden rounded-xl border border-stone-200">
                  <Editor
                    height="360px"
                    defaultLanguage={question.language || "typescript"}
                    theme="vs-dark"
                    value={String(answers[question.id] || question.starter_code)}
                    onChange={(value) => updateAnswer(question.id, value || "")}
                    options={{ minimap: { enabled: false }, fontSize: 14, scrollBeyondLastLine: false }}
                  />
                </div>
              ) : null}
            </section>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="primary" size="large" loading={submitting} icon={<SendOutlined />} onClick={() => void doSubmit()}>
          提交并进入口试
        </Button>
      </div>
    </InterviewShell>
  );
}

function formatTime(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (value % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
