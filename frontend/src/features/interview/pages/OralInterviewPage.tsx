import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRightOutlined,
  AudioOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from "@ant-design/icons";
import { Alert, Button, Empty, message, Progress, Space, Tag } from "antd";
import {
  createOrUpdateSession,
  fetchInterviewConfig,
  deleteOralRecording,
  fetchOralQuestions,
  fetchSession,
  resolveAssetUrl,
  saveOralSummary,
  uploadOralRecording,
} from "../api";
import { InterviewShell } from "../components/InterviewShell";
import { getInterviewSessionId, loadProfile } from "../storage";
import type { InterviewFlowConfig, InterviewSession, OralQuestion, OralRecording } from "../types";

const DEFAULT_ORAL_QUESTIONS = [
  "请用 1 分钟介绍你最近最能代表能力的项目。",
  "请说明这个项目中最困难的技术问题、你的解决方案和最终结果。",
  "如果线上接口 P95 延迟从 200ms 升到 2s，你会如何定位？",
  "请描述一次你和团队成员产生明显分歧，并最终推进解决的经历。",
  "如果入职后第一个月只能完成一件最能证明你价值的事，你会选择什么，为什么？",
];

type RecordedAnswer = {
  recordingId?: string;
  questionIndex: number;
  questionText: string;
  filename: string;
  durationSeconds: number;
  recordedAt: string;
  localUrl?: string;
  uploadedUrl?: string;
  blob?: Blob;
};

export default function OralInterviewPage() {
  const navigate = useNavigate();
  const sessionId = useMemo(() => getInterviewSessionId(), []);
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [flowConfig, setFlowConfig] = useState<InterviewFlowConfig | null>(null);
  const [questions, setQuestions] = useState<string[]>(DEFAULT_ORAL_QUESTIONS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordings, setRecordings] = useState<Record<number, RecordedAnswer>>({});
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const elapsedTimerRef = useRef<number>();

  const completedCount = Object.values(recordings).filter((item) => item.uploadedUrl).length;
  const activeQuestion = questions[currentIndex];
  const activeAnswer = recordings[currentIndex];
  const isCurrentRecording = recordingIndex === currentIndex;
  const canFinish = completedCount === questions.length && recordingIndex === null && uploadingIndex === null;
  const recordingSupportIssue = getRecordingSupportIssue();

  useEffect(() => {
    void ensureSession();
    return () => {
      window.clearInterval(elapsedTimerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      Object.values(recordings).forEach((item) => {
        if (item.localUrl) URL.revokeObjectURL(item.localUrl);
      });
    };
  }, []);

  useEffect(() => {
    setCurrentIndex((value) => Math.min(value, Math.max(questions.length - 1, 0)));
  }, [questions]);

  async function ensureSession() {
    setLoading(true);
    try {
      const nextConfig = await fetchInterviewConfig();
      setFlowConfig(nextConfig);
      if (!nextConfig.oral_enabled) {
        message.info("当前已关闭口试环节");
        navigate("/interview/done", { replace: true });
        return;
      }
      const nextSession = await createOrUpdateSession(sessionId, loadProfile(sessionId));
      await loadOralQuestions(nextSession.role || String(nextSession.candidate_profile.role || ""));
      restoreRecordings(nextSession);
      setSession(nextSession);
    } catch {
      try {
        const nextConfig = await fetchInterviewConfig();
        setFlowConfig(nextConfig);
        if (!nextConfig.oral_enabled) {
          message.info("当前已关闭口试环节");
          navigate("/interview/done", { replace: true });
          return;
        }
        const nextSession = await fetchSession(sessionId);
        await loadOralQuestions(nextSession.role || String(nextSession.candidate_profile.role || ""));
        restoreRecordings(nextSession);
        setSession(nextSession);
      } catch {
        message.warning("后端暂未连接，录音上传需要后端服务可用");
      }
    } finally {
      setLoading(false);
    }
  }

  async function loadOralQuestions(role: string) {
    try {
      const rows = await fetchOralQuestions(role);
      const nextQuestions = rows.map((item: OralQuestion) => item.prompt).filter(Boolean);
      if (nextQuestions.length) setQuestions(nextQuestions);
    } catch {
      setQuestions(DEFAULT_ORAL_QUESTIONS);
    }
  }

  async function startRecording(index: number) {
    if (recordingSupportIssue) {
      message.error(getRecordingSupportMessage(recordingSupportIssue));
      return;
    }
    if (recordingIndex !== null || uploadingIndex !== null) return;

    await beginRecording(index);
  }

  async function beginRecording(index: number) {
    try {
      if (!session) await ensureSession();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        void handleRecordingStop(index, recorder.mimeType || mimeType || "audio/webm", stream);
      };

      recorder.start(1000);
      setRecordingIndex(index);
      setElapsed(0);
      window.clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 500);
    } catch (error) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (
        error instanceof DOMException &&
        ["NotAllowedError", "PermissionDeniedError"].includes(error.name)
      ) {
        message.error("浏览器拒绝了麦克风权限，请允许麦克风后重试");
      } else {
        message.error("录音启动失败，请确认麦克风设备可用");
      }
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.stop();
  }

  async function handleRecordingStop(index: number, mimeType: string, stream: MediaStream) {
    window.clearInterval(elapsedTimerRef.current);
    stream.getTracks().forEach((track) => track.stop());
    setRecordingIndex(null);
    setElapsed(0);

    const chunks = chunksRef.current;
    chunksRef.current = [];
    if (!chunks.length) {
      message.warning("未采集到有效录音，请重新录制");
      return;
    }

    const durationSeconds = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    const blob = new Blob(chunks, { type: mimeType });
    const extension = getAudioExtension(mimeType);
    const answer: RecordedAnswer = {
      questionIndex: index,
      questionText: questions[index],
      filename: `oral-question-${index + 1}-${Date.now()}.${extension}`,
      durationSeconds,
      recordedAt: new Date().toISOString(),
      localUrl: URL.createObjectURL(blob),
      blob,
    };

    setRecordings((items) => {
      const previous = items[index];
      if (previous?.localUrl) URL.revokeObjectURL(previous.localUrl);
      return { ...items, [index]: answer };
    });
    await persistRecording(answer);
  }

  async function persistRecording(answer: RecordedAnswer) {
    if (!answer.blob) return;
    setUploadingIndex(answer.questionIndex);
    try {
      const nextSession = await uploadOralRecording({
        sessionId,
        questionIndex: answer.questionIndex,
        questionText: answer.questionText,
        durationSeconds: answer.durationSeconds,
        blob: answer.blob,
        filename: answer.filename,
      });
      setSession(nextSession);
      const uploaded = getLatestRecording(nextSession.oral_recordings, answer.questionIndex);
      setRecordings((items) => ({
        ...items,
        [answer.questionIndex]: {
          ...items[answer.questionIndex],
          recordingId: uploaded?.id || answer.recordingId,
          filename: uploaded?.filename || answer.filename,
          uploadedUrl: uploaded?.url,
          durationSeconds: uploaded?.duration_seconds || answer.durationSeconds,
          recordedAt: uploaded?.created_at || answer.recordedAt,
        },
      }));
      message.success(`第 ${answer.questionIndex + 1} 题录音已保存`);
      setCurrentIndex((value) =>
        value === answer.questionIndex ? Math.min(answer.questionIndex + 1, questions.length - 1) : value,
      );
    } catch {
      message.error("录音已生成，但上传失败，请检查后端服务后重试上传");
    } finally {
      setUploadingIndex(null);
    }
  }

  async function retryUpload(index: number) {
    const answer = recordings[index];
    if (!answer) {
      return;
    }

    if (answer.uploadedUrl) {
      setUploadingIndex(index);
      try {
        const recordingId =
          answer.recordingId || getLatestRecording(session?.oral_recordings || [], index)?.id;
        if (recordingId) {
          await deleteOralRecording(sessionId, recordingId);
        }
        setRecordings((items) => {
          const next = { ...items };
          const previous = next[index];
          if (previous?.localUrl) URL.revokeObjectURL(previous.localUrl);
          delete next[index];
          return next;
        });
        message.success("原录音已删除，请重新录制");
        await beginRecording(index);
      } catch {
        message.error("删除原录音失败，请确认后端服务可用");
      } finally {
        setUploadingIndex(null);
      }
      return;
    }

    if (!answer.blob) {
      message.warning("该题只有服务端录音记录，无需重新上传");
      return;
    }
    await persistRecording(answer);
  }

  async function finishInterview() {
    if (!canFinish) {
      message.warning("请先完成所有题目的录音上传");
      return;
    }
    const qa = questions.map((question, index) => {
      const answer = recordings[index];
      return {
        question,
        answer: answer?.filename || "已上传录音文件",
        audio_url: answer?.uploadedUrl || "",
        duration_seconds: answer?.durationSeconds || 0,
        at: answer?.recordedAt || new Date().toISOString(),
      };
    });

    try {
      await saveOralSummary(sessionId, qa);
      navigate("/interview/done");
    } catch {
      message.error("口试提交失败，请确认后端服务可用");
    }
  }

  function restoreRecordings(nextSession: InterviewSession) {
    const restored: Record<number, RecordedAnswer> = {};
    nextSession.oral_recordings.forEach((item) => {
      const previous = restored[item.question_index];
      if (!previous || new Date(item.created_at).valueOf() >= new Date(previous.recordedAt).valueOf()) {
        restored[item.question_index] = recordingToAnswer(item);
      }
    });
    setRecordings(restored);
    const firstUnfinished = questions.findIndex((_, index) => !restored[index]?.uploadedUrl);
    setCurrentIndex(firstUnfinished === -1 ? Math.max(questions.length - 1, 0) : firstUnfinished);
  }

  return (
    <InterviewShell
      current="oral"
      title="AI 口试"
      description="按固定问题逐题录音，系统保存候选人的原始录音文件用于后续复核。"
      oralEnabled={flowConfig?.oral_enabled ?? true}
    >
      <section className="grid gap-5 xl:grid-cols-[330px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-600">完成进度</span>
              <Tag color={canFinish ? "green" : "blue"}>
                {completedCount}/{questions.length}
              </Tag>
            </div>
            <Progress
              percent={questions.length ? Math.round((completedCount / questions.length) * 100) : 0}
              strokeColor="#14532d"
              className="mt-3"
            />
            <Button
              type="primary"
              block
              icon={<ArrowRightOutlined />}
              disabled={!canFinish}
              onClick={() => void finishInterview()}
              className="mt-4"
            >
              提交口试
            </Button>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
            {questions.map((question, index) => {
              const answer = recordings[index];
              const active = index === currentIndex;
              return (
                <button
                  key={question}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  className={`mb-2 w-full rounded-lg border px-3 py-3 text-left transition last:mb-0 ${
                    active
                      ? "border-emerald-800 bg-emerald-50"
                      : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                      Question {index + 1}
                    </span>
                    {answer?.uploadedUrl ? (
                      <CheckCircleOutlined className="text-emerald-700" />
                    ) : (
                      <Tag>待录音</Tag>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-stone-800">{question}</p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <Tag color="green">第 {currentIndex + 1} 题</Tag>
                <h2 className="mt-4 text-2xl font-semibold leading-9 text-stone-950">{activeQuestion}</h2>
              </div>
              <div className="min-w-[150px] text-right">
                {isCurrentRecording ? (
                  <>
                    <div className="text-3xl font-semibold tabular-nums text-rose-700">
                      {formatDuration(elapsed)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">录音中</div>
                  </>
                ) : activeAnswer ? (
                  <>
                    <div className="text-3xl font-semibold tabular-nums text-stone-950">
                      {formatDuration(activeAnswer.durationSeconds)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">已录制</div>
                  </>
                ) : (
                  <>
                    <div className="text-3xl font-semibold tabular-nums text-stone-300">00:00</div>
                    <div className="mt-1 text-xs text-stone-500">未录制</div>
                  </>
                )}
              </div>
            </div>

            <Space wrap className="mt-8">
              {isCurrentRecording ? (
                <Button danger size="large" icon={<StopOutlined />} onClick={stopRecording}>
                  停止录音
                </Button>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  icon={<AudioOutlined />}
                  disabled={loading || recordingIndex !== null || uploadingIndex !== null}
                  onClick={() => void startRecording(currentIndex)}
                >
                  {activeAnswer ? "重新录制本题" : "开始录音"}
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                disabled={!activeAnswer || recordingIndex !== null || uploadingIndex !== null || loading}
                loading={uploadingIndex === currentIndex}
                onClick={() => void retryUpload(currentIndex)}
              >
                {activeAnswer?.uploadedUrl ? "重新录制" : "重试上传"}
              </Button>
            </Space>

            {activeAnswer ? (
              <div className="mt-6 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Tag color={activeAnswer.uploadedUrl ? "green" : "orange"}>
                    {activeAnswer.uploadedUrl ? "已保存到数据库" : "待上传"}
                  </Tag>
                  <span className="text-sm text-stone-500">{activeAnswer.filename}</span>
                </div>
                <audio
                  controls
                  src={activeAnswer.localUrl || resolveAssetUrl(activeAnswer.uploadedUrl || "")}
                  className="w-full"
                />
              </div>
            ) : (
              <div className="mt-6">
                <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前题目暂无录音" />
              </div>
            )}

            {recordingSupportIssue === "insecure-context" ? (
              <Alert
                className="mt-6"
                showIcon
                type="warning"
                message="当前页面不是安全上下文"
                description="录音权限只允许在 https 或 localhost 下使用。若你是通过局域网 IP 打开的前端，请改为用 localhost 访问。"
              />
            ) : null}
          </div>

          <Alert
            showIcon
            type="info"
            message="录音流程说明"
            description="每道题只保存候选人的原始录音文件；重新录制会以最新一次录音作为当前题目答案，历史录音仍保留在后端记录中。"
          />
        </section>
      </section>
    </InterviewShell>
  );
}

function recordingToAnswer(item: OralRecording): RecordedAnswer {
  return {
    recordingId: item.id,
    questionIndex: item.question_index,
    questionText: item.question_text,
    filename: item.filename,
    durationSeconds: item.duration_seconds,
    recordedAt: item.created_at,
    uploadedUrl: item.url,
  };
}

function getLatestRecording(items: OralRecording[], questionIndex: number) {
  return items
    .filter((item) => item.question_index === questionIndex)
    .sort((a, b) => new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf())[0];
}

function getRecordingSupportIssue() {
  if (typeof window === "undefined") return "browser";
  if (!window.isSecureContext) return "insecure-context";
  if (typeof MediaRecorder === "undefined") return "media-recorder";
  if (!navigator.mediaDevices?.getUserMedia) return "media-devices";
  return "";
}

function getRecordingSupportMessage(issue: string) {
  if (issue === "insecure-context") {
    return "当前页面不是安全上下文，录音需要通过 localhost 或 https 打开";
  }
  if (issue === "media-recorder" || issue === "media-devices") {
    return "当前浏览器不支持录音，请使用 Chrome、Edge 或 Safari 新版本";
  }
  return "当前浏览器不支持录音";
}

function getSupportedMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function getAudioExtension(mimeType: string) {
  if (mimeType.includes("mp4")) return "m4a";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
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
