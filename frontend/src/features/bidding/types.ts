export type ProjectStatus = "registered" | "awaiting_feedback" | "completed";

export type AttachmentType = "tender_doc" | "bid_doc";

export type RowType = "group" | "project";

export interface ProjectAttachment {
  id: number;
  attachment_type: AttachmentType;
  original_name: string;
  size_bytes: number;
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

export interface BiddingProjectListItem {
  row_type: "project";
  id: number;
  group_id: number;
  name: string;
  participating_units: string;
  bid_opening_at: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  final_score: number | null;
  ranking: number | null;
}

export interface BiddingProjectGroupTreeItem {
  row_type: "group";
  id: number;
  name: string;
  bid_opening_at: string;
  created_at: string;
  updated_at: string;
  attachment_count: number;
  children: BiddingProjectListItem[];
}

export type ProjectTreeRow = BiddingProjectGroupTreeItem | BiddingProjectListItem;

export interface BiddingProjectDetail {
  id: number;
  group_id: number;
  group_name: string;
  name: string;
  participating_units: string;
  bid_opening_at: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  attachments: ProjectAttachment[];
  feedback: ProjectFeedback | null;
}

export interface PaginatedProjectTree {
  items: BiddingProjectGroupTreeItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectFormValues {
  group_mode: "existing" | "new";
  group_id?: number;
  group_name?: string;
  name?: string;
  participating_units?: string;
  bid_opening_at?: string;
  tender_doc?: File;
  bid_doc?: File;
}

export interface GroupFormValues {
  name: string;
}

export interface FeedbackFormValues {
  final_score: number;
  ranking?: number;
  score_detail?: string;
  remark?: string;
}
