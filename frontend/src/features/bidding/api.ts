import { apiClient } from "@/request/client";
import { formatChinaTimeForApi } from "@/utils/date";
import { THIRD_PARTY_BIDDING_FIELDS } from "./contracts/thirdPartyBidding";
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
  TechnicalReviewReportData,
  TechnicalReviewReportOut,
  TechnicalReviewReportRawOut,
  ThirdPartySyncStatus,
} from "./types";
import { downloadBidVersionFile, getBidVersionPreviewUrl, previewBidVersion } from "./utils/filePreview";
import type { IssueFeedback } from "./utils/technicalReportPage2Adapter";

const F = THIRD_PARTY_BIDDING_FIELDS;

export async function fetchProjects(params: {
  page?: number;
  page_size?: number;
  keyword?: string;
  status?: string;
  owner?: string;
}): Promise<PaginatedProjectTree> {
  const { data } = await apiClient.get<PaginatedProjectTree>("/api/bidding-projects", { params });
  return data;
}

export async function fetchProject(id: number): Promise<BiddingProjectDetail> {
  const { data } = await apiClient.get<BiddingProjectDetail>(`/api/bidding-projects/${id}`);
  return data;
}

export async function fetchProjectFormOptions(dbId?: number): Promise<ProjectFormOptions> {
  const { data } = await apiClient.get<ProjectFormOptions>("/api/bidding-projects/form-options", {
    params: dbId ? { db_id: dbId } : undefined,
  });
  return data;
}

export async function fetchGroups(keyword?: string): Promise<BiddingProjectGroupListItem[]> {
  const { data } = await apiClient.get<BiddingProjectGroupListItem[]>("/api/bidding-project-groups", {
    params: keyword ? { keyword } : undefined,
  });
  return data;
}

export async function fetchGroup(dbId: number): Promise<BiddingProjectGroupDetail> {
  const { data } = await apiClient.get<BiddingProjectGroupDetail>(`/api/bidding-project-groups/${dbId}`);
  return data;
}

function buildProjectFormData(values: ProjectFormValues): FormData {
  const formData = new FormData();
  if (values.name?.trim()) {
    formData.append("name", values.name.trim());
  }
  formData.append("participating_units", (values.participating_units || "").trim());

  if (values.db_id) {
    formData.append(F.db_id, String(values.db_id));
  } else if (values.project_name) {
    formData.append(F.project_name, values.project_name.trim());
  }
  if (values.bid_opening_time) {
    formData.append(F.bid_opening_time, formatChinaTimeForApi(values.bid_opening_time));
  }
  if (values.project_id) formData.append(F.project_id, values.project_id.trim());
  if (values.third_party_file_name) {
    formData.append(F.third_party_file_name, values.third_party_file_name.trim());
  }
  if (values.evaluation_date) {
    formData.append(F.evaluation_date, formatChinaTimeForApi(values.evaluation_date));
  }
  if (values.tender_doc) formData.append("tender_doc", values.tender_doc);
  if (values.bid_file) formData.append(F.bid_file, values.bid_file);
  return formData;
}

export async function createGroup(
  projectName: string,
  bidFile?: File,
  bidOpeningTime?: string,
  options?: {
    projectId?: string;
    thirdPartyFileName?: string;
    evaluationDate?: string;
  },
): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append(F.project_name, projectName.trim());
  if (bidFile) formData.append(F.bid_file, bidFile);
  if (bidOpeningTime) formData.append(F.bid_opening_time, formatChinaTimeForApi(bidOpeningTime));
  if (options?.projectId) formData.append(F.project_id, options.projectId.trim());
  const thirdPartyFileName = options?.thirdPartyFileName?.trim() || bidFile?.name;
  if (thirdPartyFileName) {
    formData.append(F.third_party_file_name, thirdPartyFileName);
  }
  if (options?.evaluationDate) {
    formData.append(F.evaluation_date, formatChinaTimeForApi(options.evaluationDate));
  }
  const { data } = await apiClient.post<BiddingProjectGroupDetail>("/api/bidding-project-groups", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function syncGroupThirdParty(
  dbId: number,
  project: {
    db_id: number;
    project_code?: string;
    project_id?: string;
  },
): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append("third_party_db_id", String(project.db_id));
  if (project.project_code) formData.append("project_code", project.project_code);
  if (project.project_id) formData.append(F.project_id, project.project_id);
  const { data } = await apiClient.patch<BiddingProjectGroupDetail>(
    `/api/bidding-project-groups/${dbId}/third-party`,
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

export async function bindBidVersionThirdPartySubmission(args: {
  attachmentId: number;
  submissionFileId: string;
  status?: string;
  report?: Record<string, unknown>;
  reportData?: Record<string, unknown>;
}): Promise<ProjectAttachment> {
  const { data } = await apiClient.patch<ProjectAttachment>(
    `/api/bid-versions/${args.attachmentId}/third-party-submission`,
    {
      submission_file_id: args.submissionFileId,
      status: args.status,
      report: args.report,
      report_data: args.reportData,
    },
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

export async function updateGroup(dbId: number, values: GroupFormValues): Promise<BiddingProjectGroupDetail> {
  const formData = new FormData();
  formData.append(F.project_name, values.project_name.trim());
  formData.append(F.bid_opening_time, formatChinaTimeForApi(values.bid_opening_time));
  if (values.project_id) formData.append(F.project_id, values.project_id.trim());
  if (values.evaluation_date) {
    formData.append(F.evaluation_date, formatChinaTimeForApi(values.evaluation_date));
  }
  const { data } = await apiClient.patch<BiddingProjectGroupDetail>(
    `/api/bidding-project-groups/${dbId}`,
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

export async function deleteGroup(id: number) {
  await apiClient.delete(`/api/bidding-project-groups/${id}`);
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

export async function uploadBidVersionReportData(args: {
  reportData: TechnicalReviewReportData | Record<string, unknown>;
}): Promise<ProjectAttachment> {
  const { data } = await apiClient.post<ProjectAttachment>(
    "/api/bid-versions/report-data",
    args.reportData,
  );
  return data;
}

export async function fetchBidVersionReportData(attachmentId: number): Promise<TechnicalReviewReportOut> {
  const { data } = await apiClient.get<TechnicalReviewReportOut>(
    `/api/bid-versions/${attachmentId}/report-data`,
  );
  return data;
}

export async function fetchBidVersionReportDataRaw(
  attachmentId: number,
): Promise<TechnicalReviewReportRawOut> {
  const { data } = await apiClient.get<TechnicalReviewReportRawOut>(
    `/api/bid-versions/${attachmentId}/report-data`,
  );
  return data;
}

export async function updateBidVersionIssueFeedback(args: {
  attachmentId: number;
  issueId: string;
  feedback: IssueFeedback | null;
}): Promise<TechnicalReviewReportRawOut> {
  const { data } = await apiClient.patch<TechnicalReviewReportRawOut>(
    `/api/bid-versions/${args.attachmentId}/report-data/issues/${encodeURIComponent(args.issueId)}/feedback`,
    { feedback: args.feedback },
  );
  return data;
}

export function getGroupAttachmentDownloadUrl(groupId: number, attachmentId: number) {
  const base = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL ?? "");
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
