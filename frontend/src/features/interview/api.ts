import axios from "axios";
import type {
  CandidateProfile,
  InterviewResultDetail,
  InterviewResultSummary,
  InterviewSession,
  JobPosition,
  JobPositionCreate,
  JobPositionUpdate,
  LlmModelConfig,
  LlmModelConfigUpdate,
  OralQuestion,
  Question,
  QuestionGenerationRequest,
  QuestionGenerationResponse,
  WrittenQuestion,
  WrittenExamSubmission,
} from "./types";

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8010";
export const PUBLIC_BASE_URL = import.meta.env.VITE_PUBLIC_BASE_URL || API_BASE_URL;

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
});

export async function createOrUpdateSession(sessionId: string, profile: CandidateProfile) {
  const { data } = await client.post<InterviewSession>("/api/sessions", {
    session_id: sessionId,
    role: profile.role,
    candidate_profile: profile,
  });
  return data;
}

export async function patchSession(sessionId: string, profile: CandidateProfile) {
  const { data } = await client.patch<InterviewSession>(`/api/sessions/${sessionId}`, {
    role: profile.role,
    candidate_profile: profile,
  });
  return data;
}

export async function fetchSession(sessionId: string) {
  const { data } = await client.get<InterviewSession>(`/api/sessions/${sessionId}`);
  return data;
}

export async function uploadResumeAttachment(sessionId: string, file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await client.post<InterviewSession>(`/api/sessions/${sessionId}/attachments`, form);
  return data;
}

export async function fetchInterviewResults() {
  const { data } = await client.get<InterviewResultSummary[]>("/api/interview-results");
  return data;
}

export async function fetchInterviewResultDetail(sessionId: string) {
  const { data } = await client.get<InterviewResultDetail>(`/api/interview-results/${sessionId}`);
  return data;
}

export async function fetchQuestions(role: string) {
  const { data } = await client.get<Question[]>("/api/questions", { params: { role } });
  return data;
}

export async function fetchOralQuestions(role: string) {
  const { data } = await client.get<OralQuestion[]>("/api/oral-questions", { params: { role } });
  return data;
}

export async function fetchPositions() {
  const { data } = await client.get<JobPosition[]>("/api/positions");
  return data;
}

export async function fetchAdminPositions() {
  const { data } = await client.get<JobPosition[]>("/api/admin/positions");
  return data;
}

export async function createAdminPosition(payload: JobPositionCreate) {
  const { data } = await client.post<JobPosition>("/api/admin/positions", payload);
  return data;
}

export async function updateAdminPosition(positionId: string, payload: JobPositionUpdate) {
  const { data } = await client.patch<JobPosition>(`/api/admin/positions/${positionId}`, payload);
  return data;
}

export async function deleteAdminPosition(positionId: string) {
  const { data } = await client.delete<{ ok: boolean }>(`/api/admin/positions/${positionId}`);
  return data;
}

export async function fetchAdminWrittenQuestions() {
  const { data } = await client.get<WrittenQuestion[]>("/api/admin/written-questions");
  return data;
}

export async function createAdminWrittenQuestion(payload: Omit<WrittenQuestion, "id" | "created_at" | "updated_at">) {
  const { data } = await client.post<WrittenQuestion>("/api/admin/written-questions", payload);
  return data;
}

export async function updateAdminWrittenQuestion(
  questionId: string,
  payload: Partial<Omit<WrittenQuestion, "id" | "created_at" | "updated_at">>,
) {
  const { data } = await client.patch<WrittenQuestion>(`/api/admin/written-questions/${questionId}`, payload);
  return data;
}

export async function deleteAdminWrittenQuestion(questionId: string) {
  const { data } = await client.delete<{ ok: boolean }>(`/api/admin/written-questions/${questionId}`);
  return data;
}

export async function fetchAdminOralQuestions() {
  const { data } = await client.get<OralQuestion[]>("/api/admin/oral-questions");
  return data;
}

export async function createAdminOralQuestion(payload: Omit<OralQuestion, "id" | "created_at" | "updated_at">) {
  const { data } = await client.post<OralQuestion>("/api/admin/oral-questions", payload);
  return data;
}

export async function updateAdminOralQuestion(questionId: string, payload: Partial<Omit<OralQuestion, "id" | "created_at" | "updated_at">>) {
  const { data } = await client.patch<OralQuestion>(`/api/admin/oral-questions/${questionId}`, payload);
  return data;
}

export async function deleteAdminOralQuestion(questionId: string) {
  const { data } = await client.delete<{ ok: boolean }>(`/api/admin/oral-questions/${questionId}`);
  return data;
}

export async function generateAdminWrittenQuestions(payload: QuestionGenerationRequest) {
  const { data } = await client.post<QuestionGenerationResponse>("/api/admin/written-questions/generate", payload, { timeout: 120_000 });
  return data;
}

export async function fetchAdminModelConfig() {
  const { data } = await client.get<LlmModelConfig>("/api/admin/model-config");
  return data;
}

export async function updateAdminModelConfig(payload: LlmModelConfigUpdate) {
  const { data } = await client.put<LlmModelConfig>("/api/admin/model-config", payload);
  return data;
}

export async function submitWrittenExam(sessionId: string, payload: WrittenExamSubmission) {
  const { data } = await client.post<InterviewSession>(`/api/sessions/${sessionId}/written-submission`, payload);
  return data;
}

export async function sendRtcOffer(sessionId: string, offer: RTCSessionDescriptionInit) {
  const { data } = await client.post<RTCSessionDescriptionInit>("/api/rtc/offer", {
    session_id: sessionId,
    sdp: offer.sdp,
    type: offer.type,
  });
  return data;
}

export async function startOralInterview(sessionId: string) {
  const { data } = await client.post<{ assistant_text: string; stage: string }>(
    `/api/sessions/${sessionId}/oral/start`,
    { session_id: sessionId },
  );
  return data;
}

export async function respondOralInterview(sessionId: string, text: string) {
  const { data } = await client.post<{ assistant_text: string; stage: string }>(
    `/api/sessions/${sessionId}/oral/respond`,
    { session_id: sessionId, text },
  );
  return data;
}

export async function uploadSnapshot(sessionId: string, blob: Blob, captureIndex: number) {
  const form = new FormData();
  form.append("capture_index", String(captureIndex));
  form.append("file", blob, `snapshot-${captureIndex}.jpg`);
  const { data } = await client.post<InterviewSession>(`/api/sessions/${sessionId}/snapshots`, form);
  return data;
}

export async function uploadOralRecording({
  sessionId,
  questionIndex,
  questionText,
  durationSeconds,
  blob,
  filename,
}: {
  sessionId: string;
  questionIndex: number;
  questionText: string;
  durationSeconds: number;
  blob: Blob;
  filename: string;
}) {
  const form = new FormData();
  form.append("question_index", String(questionIndex));
  form.append("question_text", questionText);
  form.append("duration_seconds", String(durationSeconds));
  form.append("file", blob, filename);
  const { data } = await client.post<InterviewSession>(`/api/sessions/${sessionId}/oral-recordings`, form);
  return data;
}

export async function saveOralSummary(sessionId: string, qa: unknown[]) {
  const { data } = await client.post<InterviewSession>(`/api/sessions/${sessionId}/oral-summary`, {
    session_id: sessionId,
    qa,
    ended_at: new Date().toISOString(),
  });
  return data;
}

export function resolveAssetUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `${API_BASE_URL}${url}`;
}
