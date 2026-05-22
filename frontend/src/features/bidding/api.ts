import dayjs from "dayjs";
import { apiClient } from "@/request/client";
import type {
  BiddingProjectDetail,
  FeedbackFormValues,
  PaginatedProjects,
  ProjectFormValues,
} from "./types";

export async function fetchProjects(params: {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
}): Promise<PaginatedProjects> {
  const { data } = await apiClient.get<PaginatedProjects>("/api/bidding-projects", { params });
  return data;
}

export async function fetchProject(id: number): Promise<BiddingProjectDetail> {
  const { data } = await apiClient.get<BiddingProjectDetail>(`/api/bidding-projects/${id}`);
  return data;
}

function buildProjectFormData(values: ProjectFormValues): FormData {
  const formData = new FormData();
  formData.append("name", values.name.trim());
  formData.append("participating_units", values.participating_units.trim());
  formData.append("bid_opening_at", dayjs(values.bid_opening_at).format("YYYY-MM-DDTHH:mm:ss"));
  if (values.tender_doc) formData.append("tender_doc", values.tender_doc);
  if (values.bid_doc) formData.append("bid_doc", values.bid_doc);
  return formData;
}

export async function createProject(values: ProjectFormValues): Promise<BiddingProjectDetail> {
  const { data } = await apiClient.post<BiddingProjectDetail>(
    "/api/bidding-projects",
    buildProjectFormData(values),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function updateProject(id: number, values: Partial<ProjectFormValues>): Promise<BiddingProjectDetail> {
  const formData = new FormData();
  if (values.name) formData.append("name", values.name.trim());
  if (values.participating_units) formData.append("participating_units", values.participating_units.trim());
  if (values.bid_opening_at) formData.append("bid_opening_at", dayjs(values.bid_opening_at).format("YYYY-MM-DDTHH:mm:ss"));
  if (values.tender_doc) formData.append("tender_doc", values.tender_doc);
  if (values.bid_doc) formData.append("bid_doc", values.bid_doc);
  const { data } = await apiClient.patch<BiddingProjectDetail>(`/api/bidding-projects/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function submitFeedback(id: number, values: FeedbackFormValues) {
  const { data } = await apiClient.post(`/api/bidding-projects/${id}/feedback`, values);
  return data;
}

export async function deleteProject(id: number) {
  await apiClient.delete(`/api/bidding-projects/${id}`);
}

export function getAttachmentDownloadUrl(projectId: number, attachmentId: number) {
  const base = import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8010";
  return `${base}/api/bidding-projects/${projectId}/attachments/${attachmentId}/download`;
}
