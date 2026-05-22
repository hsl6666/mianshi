import type { AttachmentType, ProjectStatus } from "./types";

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

export const ACCEPTED_FILE_TYPES = ".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.7z";
