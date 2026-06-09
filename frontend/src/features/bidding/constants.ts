import type { AttachmentType, ProjectStatus, ReportStatus, ThirdPartySyncStatus } from "./types";
import type { BidVersionListItem } from "./types";

export const PROJECT_STATUS_MAP: Record<
  ProjectStatus,
  { label: string; color: "default" | "processing" | "success" | "warning" }
> = {
  registered: { label: "已登记", color: "default" },
  awaiting_feedback: { label: "待反馈", color: "warning" },
  completed: { label: "已完成", color: "success" },
};

export const ATTACHMENT_TYPE_MAP: Record<AttachmentType, string> = {
  tender_doc: "招标文件",
  bid_doc: "投标文件",
};

export const THIRD_PARTY_SYNC_STATUS_MAP: Record<
  ThirdPartySyncStatus,
  { label: string; color: "default" | "success" }
> = {
  unsynced: { label: "未同步", color: "default" },
  synced: { label: "已同步", color: "success" },
};

export const REPORT_STATUS_MAP: Record<
  ReportStatus,
  { label: string; color: "default" | "processing" | "success" | "error" }
> = {
  pending: { label: "待分析", color: "default" },
  analyzing: { label: "分析中", color: "processing" },
  completed: { label: "分析完成", color: "success" },
  failed: { label: "分析失败", color: "error" },
};

export function resolveReportStatus(
  record: Pick<BidVersionListItem, "report_status" | "report_has_data">,
): ReportStatus {
  if (record.report_status) return record.report_status;
  return record.report_has_data ? "completed" : "pending";
}

export const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z";
