import { apiClient } from "@/request/client";

export interface ReportFeedbackTagItem {
  id: number;
  feedback_type: "like" | "dislike";
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportFeedbackEntryItem {
  id: number;
  attachment_id: number;
  issue_id?: string | null;
  feedback_type: "like" | "dislike" | "report_suggestion";
  tags: string[];
  comment?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  project_id?: number | null;
  project_name?: string | null;
  company_name?: string | null;
  version_number?: number | null;
  group_name?: string | null;
  report_url?: string | null;
}

export interface PaginatedReportFeedbackEntries {
  items: ReportFeedbackEntryItem[];
  total: number;
  page: number;
  page_size: number;
}

export async function fetchPublicReportFeedbackTags(
  feedbackType?: "like" | "dislike",
): Promise<ReportFeedbackTagItem[]> {
  const { data } = await apiClient.get<ReportFeedbackTagItem[]>("/api/public/report-feedback-tags", {
    params: feedbackType ? { feedback_type: feedbackType } : undefined,
  });
  return data;
}

export async function fetchReportFeedbackTags(): Promise<ReportFeedbackTagItem[]> {
  const { data } = await apiClient.get<ReportFeedbackTagItem[]>("/api/report-feedback/tags");
  return data;
}

export async function createReportFeedbackTag(payload: {
  feedback_type: "like" | "dislike";
  label: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<ReportFeedbackTagItem> {
  const { data } = await apiClient.post<ReportFeedbackTagItem>("/api/report-feedback/tags", payload);
  return data;
}

export async function updateReportFeedbackTag(
  tagId: number,
  payload: Partial<{
    feedback_type: "like" | "dislike";
    label: string;
    sort_order: number;
    is_active: boolean;
  }>,
): Promise<ReportFeedbackTagItem> {
  const { data } = await apiClient.patch<ReportFeedbackTagItem>(`/api/report-feedback/tags/${tagId}`, payload);
  return data;
}

export async function deleteReportFeedbackTag(tagId: number): Promise<void> {
  await apiClient.delete(`/api/report-feedback/tags/${tagId}`);
}

export async function fetchReportFeedbackEntries(params: {
  page?: number;
  page_size?: number;
  keyword?: string;
  feedback_type?: string;
  project_id?: number;
}): Promise<PaginatedReportFeedbackEntries> {
  const { data } = await apiClient.get<PaginatedReportFeedbackEntries>("/api/report-feedback/entries", {
    params,
  });
  return data;
}

export async function deleteReportFeedbackEntry(entryId: number): Promise<void> {
  await apiClient.delete(`/api/report-feedback/entries/${entryId}`);
}

export function groupReportFeedbackTags(tags: ReportFeedbackTagItem[]) {
  return {
    like: tags.filter((tag) => tag.feedback_type === "like" && tag.is_active).map((tag) => tag.label),
    dislike: tags.filter((tag) => tag.feedback_type === "dislike" && tag.is_active).map((tag) => tag.label),
  };
}
