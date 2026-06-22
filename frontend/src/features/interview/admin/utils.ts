import type { WrittenQuestion } from "../types";

export type QuestionFormValues = Omit<WrittenQuestion, "id" | "created_at" | "updated_at">;

export function defaultQuestionForm(): QuestionFormValues {
  return {
    title: "",
    type: "short",
    prompt: "",
    options: [{ label: "", value: "" }],
    starter_code: "",
    language: "typescript",
    role_tags: "通用",
    difficulty: "medium",
    source: "manual",
    evaluation_points: "",
    published: false,
  };
}

export function questionToFormValues(question: WrittenQuestion): QuestionFormValues {
  return {
    title: question.title || "",
    type: question.type || "short",
    prompt: question.prompt || "",
    options: question.options?.length ? question.options : [{ label: "", value: "" }],
    starter_code: question.starter_code || "",
    language: question.language || "typescript",
    role_tags: question.role_tags || "通用",
    difficulty: question.difficulty || "medium",
    source: question.source || "manual",
    evaluation_points: question.evaluation_points || "",
    published: Boolean(question.published),
  };
}

export function normalizeQuestionPayload(values: QuestionFormValues): QuestionFormValues {
  const options = values.type === "single" || values.type === "multi" ? (values.options || []).filter((item) => item.label && item.value) : [];
  return {
    ...values,
    options,
    starter_code: values.type === "code" ? values.starter_code || "" : "",
    language: values.type === "code" ? values.language || "typescript" : "typescript",
    source: values.source || "manual",
  };
}

export function getApiErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: unknown } } }).response;
    const detail = response?.data?.detail;
    if (typeof detail === "string" && detail.trim()) return detail;
  }
  if (error instanceof Error && error.message) return error.message;
  return "生成题目失败";
}
