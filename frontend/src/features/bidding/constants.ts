import type { AttachmentType, ProjectStatus, ThirdPartySyncStatus } from "./types";

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
  "pending" | "uploaded",
  { label: string; color: "default" | "success" }
> = {
  pending: { label: "未上传", color: "default" },
  uploaded: { label: "已上传", color: "success" },
};

export const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z";
