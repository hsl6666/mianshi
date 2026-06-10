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

export function formatVersionReportScore(
  record: Pick<BidVersionListItem, "report_final_score" | "report_has_data">,
): string {
  if (!record.report_has_data || record.report_final_score == null) return "-";
  const score = record.report_final_score;
  const formatted = Number.isInteger(score) ? String(score) : score.toFixed(2).replace(/(\.\d)0$/, "$1");
  return `${formatted}分`;
}

export interface VersionReportStats {
  total: number;
  incomplete: number;
}

export function countVersionReportStats(
  versions: Pick<BidVersionListItem, "report_status" | "report_has_data">[],
): VersionReportStats {
  return versions.reduce<VersionReportStats>(
    (acc, version) => {
      acc.total += 1;
      if (resolveReportStatus(version) !== "completed") {
        acc.incomplete += 1;
      }
      return acc;
    },
    { total: 0, incomplete: 0 },
  );
}
