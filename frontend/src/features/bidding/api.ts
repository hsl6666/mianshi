import dayjs from "dayjs";
import { apiClient } from "@/request/client";
import type {
  BiddingProjectDetail,
  BiddingProjectGroupDetail,
  BiddingProjectGroupListItem,
  FeedbackFormValues,
  GroupFormValues,
  PaginatedProjectTree,
  ProjectFormValues,
} from "./types";

export async function fetchProjects(params: {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
}): Promise<PaginatedProjectTree> {
  const { data } = await apiClient.get<PaginatedProjectTree>("/api/bidding-projects", { params });
  return data;
}

export async function fetchProject(id: number): Promise<BiddingProjectDetail> {
  const { data } = await apiClient.get<BiddingProjectDetail>(`/api/bidding-projects/${id}`);
  return data;
}

export async function fetchGroups(keyword?: string): Promise<BiddingProjectGroupListItem[]> {
  const { data } = await apiClient.get<BiddingProjectGroupListItem[]>("/api/bidding-project-groups", {
    params: keyword ? { keyword } : undefined,
  });
  return data;
}

export async function fetchGroup(id: number): Promise<BiddingProjectGroupDetail> {
  const { data } = await apiClient.get<BiddingProjectGroupDetail>(`/api/bidding-project-groups/${id}`);
  return data;
}

function buildProjectFormData(values: ProjectFormValues): FormData {
  const formData = new FormData();
  formData.append("name", (values.name || "").trim());
  formData.append("participating_units", (values.participating_units || "").trim());
  formData.append("bid_opening_at", dayjs(values.bid_opening_at).format("YYYY-MM-DDTHH:mm:ss"));

  if (values.group_id) {
    formData.append("group_id", String(values.group_id));
  } else if (values.group_name) {
    formData.append("group_name", values.group_name.trim());
  }
  if (values.tender_doc) formData.append("tender_doc", values.tender_doc);
  if (values.bid_doc) formData.append("bid_doc", values.bid_doc);
  return formData;
}

export async function createGroup(name: string): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append("name", name.trim());
  const { data } = await apiClient.post<BiddingProjectGroupDetail>(
    "/api/bidding-project-groups",
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function createProject(values: ProjectFormValues): Promise<BiddingProjectDetail> {
  const { data } = await apiClient.post<BiddingProjectDetail>(
    "/api/bidding-projects",
    buildProjectFormData(values),
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function updateProject(
  id: number,
  values: Required<Pick<ProjectFormValues, "name" | "participating_units" | "bid_opening_at">>,
): Promise<BiddingProjectDetail> {
  const formData = new FormData();
  formData.append("name", values.name!.trim());
  formData.append("participating_units", values.participating_units!.trim());
  formData.append("bid_opening_at", dayjs(values.bid_opening_at).format("YYYY-MM-DDTHH:mm:ss"));
  const { data } = await apiClient.patch<BiddingProjectDetail>(`/api/bidding-projects/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateGroup(id: number, values: GroupFormValues): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append("name", values.name.trim());
  const { data } = await apiClient.patch<BiddingProjectGroupDetail>(
    `/api/bidding-project-groups/${id}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function submitFeedback(id: number, values: FeedbackFormValues) {
  const { data } = await apiClient.post(`/api/bidding-projects/${id}/feedback`, values);
  return data;
}

export async function deleteProject(id: number) {
  await apiClient.delete(`/api/bidding-projects/${id}`);
}

export function getGroupAttachmentDownloadUrl(groupId: number, attachmentId: number) {
  const base = import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8010";
  return `${base}/api/bidding-project-groups/${groupId}/attachments/${attachmentId}/download`;
}

export async function downloadGroupAttachment(args: {
  groupId: number;
  attachmentId: number;
  filename: string;
}) {
  const { groupId, attachmentId, filename } = args;
  const url = `/api/bidding-project-groups/${groupId}/attachments/${attachmentId}/download`;

  const response = await apiClient.get<Blob>(url, { responseType: "blob" });
  const blob = response.data;
  const contentType = blob?.type || "application/octet-stream";
  const finalBlob = blob instanceof Blob ? new Blob([blob], { type: contentType }) : blob;

  const objectUrl = URL.createObjectURL(finalBlob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 让浏览器先开始接收/保存文件，避免立即回收导致偶发的下载失败
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

export async function downloadProjectAttachment(args: {
  projectId: number;
  attachmentId: number;
  filename: string;
}) {
  const { projectId, attachmentId, filename } = args;
  const url = `/api/bidding-projects/${projectId}/attachments/${attachmentId}/download`;

  const response = await apiClient.get<Blob>(url, { responseType: "blob" });
  const blob = response.data;
  const contentType = blob?.type || "application/octet-stream";
  const finalBlob = blob instanceof Blob ? new Blob([blob], { type: contentType }) : blob;

  const objectUrl = URL.createObjectURL(finalBlob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
