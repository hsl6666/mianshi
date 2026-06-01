import { apiClient } from "@/request/client";
import { formatChinaTimeForApi } from "@/utils/date";
import type {
  BiddingProjectDetail,
  BiddingProjectGroupDetail,
  BiddingProjectGroupListItem,
  BiddingCompanyDetail,
  FeedbackFormValues,
  GroupFormValues,
  PaginatedProjectTree,
  ProjectAttachment,
  ProjectFormOptions,
  ProjectFormValues,
  ThirdPartySyncStatus,
} from "./types";
import { downloadBidVersionFile, getBidVersionPreviewUrl, previewBidVersion } from "./utils/filePreview";

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

export async function fetchProjectFormOptions(groupId?: number): Promise<ProjectFormOptions> {
  const { data } = await apiClient.get<ProjectFormOptions>("/api/bidding-projects/form-options", {
    params: groupId ? { group_id: groupId } : undefined,
  });
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

  if (values.group_id) {
    formData.append("group_id", String(values.group_id));
  } else if (values.group_name) {
    formData.append("group_name", values.group_name.trim());
  }
  if (values.tender_doc) formData.append("tender_doc", values.tender_doc);
  if (values.bid_doc) formData.append("bid_doc", values.bid_doc);
  return formData;
}

export async function createGroup(
  name: string,
  tenderDoc?: File,
  bidOpeningAt?: string,
): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append("name", name.trim());
  if (tenderDoc) formData.append("tender_doc", tenderDoc);
  if (bidOpeningAt) formData.append("bid_opening_at", formatChinaTimeForApi(bidOpeningAt));
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
  values: Required<Pick<ProjectFormValues, "name" | "participating_units">>,
): Promise<BiddingProjectDetail> {
  const formData = new FormData();
  formData.append("name", values.name!.trim());
  formData.append("participating_units", values.participating_units!.trim());
  const { data } = await apiClient.patch<BiddingProjectDetail>(`/api/bidding-projects/${id}`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function updateGroup(id: number, values: GroupFormValues): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append("name", values.name.trim());
  formData.append("bid_opening_at", formatChinaTimeForApi(values.bid_opening_at));
  const { data } = await apiClient.patch<BiddingProjectGroupDetail>(
    `/api/bidding-project-groups/${id}`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function submitFeedback(companyId: number, values: FeedbackFormValues) {
  const { data } = await apiClient.post(`/api/bidding-companies/${companyId}/feedback`, values);
  return data;
}

export async function fetchCompany(id: number): Promise<BiddingCompanyDetail> {
  const { data } = await apiClient.get<BiddingCompanyDetail>(`/api/bidding-companies/${id}`);
  return data;
}

export async function deleteProject(id: number) {
  await apiClient.delete(`/api/bidding-projects/${id}`);
}

export async function deleteCompany(id: number) {
  await apiClient.delete(`/api/bidding-companies/${id}`);
}

export async function deleteBidVersion(id: number) {
  await apiClient.delete(`/api/bid-versions/${id}`);
}

export async function updateBidVersionAnalysisStatus(args: {
  attachmentId: number;
  analysisStatus: boolean;
}) {
  const { data } = await apiClient.patch<{ analysis_status: boolean }>(
    `/api/bid-versions/${args.attachmentId}/analysis-status`,
    { analysis_status: args.analysisStatus },
  );
  return data;
}

export async function updateBidVersionThirdPartySyncStatus(args: {
  attachmentId: number;
  thirdPartySyncStatus: ThirdPartySyncStatus;
}) {
  const { data } = await apiClient.patch<{ third_party_sync_status: ThirdPartySyncStatus }>(
    `/api/bid-versions/${args.attachmentId}/third-party-sync-status`,
    { third_party_sync_status: args.thirdPartySyncStatus },
  );
  return data;
}

export async function uploadBidVersionReport(args: {
  attachmentId: number;
  file: File;
}): Promise<ProjectAttachment> {
  const formData = new FormData();
  formData.append("report_file", args.file);
  const { data } = await apiClient.post<ProjectAttachment>(
    `/api/bid-versions/${args.attachmentId}/report`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
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

export async function downloadBidVersion(args: { attachmentId: number; filename: string }) {
  await downloadBidVersionFile(args);
}

export async function downloadBidVersionReport(args: { attachmentId: number; filename: string }) {
  const { attachmentId, filename } = args;
  const response = await apiClient.get<Blob>(`/api/bid-versions/${attachmentId}/report/download`, {
    responseType: "blob",
  });
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

export { previewBidVersion, getBidVersionPreviewUrl };
