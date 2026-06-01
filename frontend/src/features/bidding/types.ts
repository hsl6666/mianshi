export type ProjectStatus = "registered" | "awaiting_feedback" | "completed";

export type ThirdPartySyncStatus = "unsynced" | "synced";

export type AttachmentType = "tender_doc" | "bid_doc";

export type RowType = "group" | "project" | "company" | "version";

export interface ProjectAttachment {
  id: number;
  attachment_type: AttachmentType;
  original_name: string;
  size_bytes: number;
  version_number?: number | null;
  analysis_status?: boolean;
  third_party_sync_status?: ThirdPartySyncStatus;
  report_original_name?: string | null;
  report_size_bytes?: number | null;
  report_uploaded_at?: string | null;
  created_at: string;
}

export interface ProjectFeedback {
  id: number;
  final_score: number;
  ranking: number | null;
  score_detail: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
}

export interface BiddingProjectGroupListItem {
  id: number;
  name: string;
  bid_opening_at: string;
  created_at: string;
  updated_at: string;
  attachment_count: number;
  project_count: number;
}

export interface BiddingProjectGroupDetail {
  id: number;
  name: string;
  bid_opening_at: string;
  created_at: string;
  updated_at: string;
  attachments: ProjectAttachment[];
}

export interface BidVersionListItem {
  row_type: "version";
  id: number;
  company_id: number;
  project_id: number;
  version_number: number;
  original_name: string;
  size_bytes: number;
  analysis_status: boolean;
  third_party_sync_status: ThirdPartySyncStatus;
  report_original_name: string | null;
  report_size_bytes: number | null;
  report_uploaded_at: string | null;
  created_at: string;
}

export interface BiddingCompanyListItem {
  row_type: "company";
  id: number;
  project_id: number;
  name: string;
  bid_opening_at: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  version_count: number;
  final_score: number | null;
  ranking: number | null;
  children: BidVersionListItem[];
}

export interface BiddingCompanyDetail {
  id: number;
  project_id: number;
  name: string;
  created_at: string;
  updated_at: string;
  attachments: ProjectAttachment[];
  feedback: ProjectFeedback | null;
}

export interface BiddingProjectListItem {
  row_type: "project";
  id: number;
  group_id: number;
  name: string;
  participating_units: string;
  bid_opening_at: string;
  status: ProjectStatus;
  third_party_sync_status: ThirdPartySyncStatus;
  created_at: string;
  updated_at: string;
  final_score: number | null;
  ranking: number | null;
  company_count: number;
  attachments: ProjectAttachment[];
  children: BiddingCompanyListItem[];
}

export interface BiddingProjectGroupTreeItem {
  row_type: "group";
  id: number;
  name: string;
  bid_opening_at: string;
  created_at: string;
  updated_at: string;
  attachment_count: number;
  attachments: ProjectAttachment[];
  children: BiddingProjectListItem[];
}

export type ProjectTreeRow =
  | BiddingProjectGroupTreeItem
  | BiddingProjectListItem
  | BiddingCompanyListItem
  | BidVersionListItem;

export interface BiddingProjectDetail {
  id: number;
  group_id: number;
  group_name: string;
  name: string;
  participating_units: string;
  bid_opening_at: string;
  status: ProjectStatus;
  third_party_sync_status: ThirdPartySyncStatus;
  created_at: string;
  updated_at: string;
  attachments: ProjectAttachment[];
  companies: BiddingCompanyDetail[];
}

export interface PaginatedProjectTree {
  items: BiddingProjectGroupTreeItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectRevisionPreset {
  groupId: number;
  projectName: string;
  companyName: string;
  bidOpeningAt: string;
}

export interface ProjectFormOptions {
  project_names: string[];
  company_names: string[];
}

export interface ProjectFormValues {
  group_mode: "existing" | "new";
  group_id?: number;
  group_name?: string;
  group_bid_opening_at?: string;
  name?: string;
  participating_units?: string;
  tender_doc?: File;
  bid_doc?: File;
}

export interface GroupFormValues {
  name: string;
  bid_opening_at: string;
}

export interface FeedbackFormValues {
  final_score: number;
  ranking?: number;
  score_detail?: string;
  remark?: string;
}

export interface FeedbackTarget {
  companyId: number;
  companyName: string;
  projectName: string;
  feedback: ProjectFeedback | null;
}
