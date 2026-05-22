export type ProjectStatus = "registered" | "awaiting_feedback" | "completed";

export type AttachmentType = "tender_doc" | "bid_doc";

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

export interface BiddingProjectListItem {
  id: number;
  name: string;
  participating_units: string;
  bid_opening_at: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
  final_score: number | null;
  ranking: number | null;
  attachment_count: number;
}

export interface BiddingProjectDetail extends BiddingProjectListItem {
  attachments: ProjectAttachment[];
  feedback: ProjectFeedback | null;
}

export interface PaginatedProjects {
  items: BiddingProjectListItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface ProjectFormValues {
  name: string;
  participating_units: string;
  bid_opening_at: string;
  tender_doc?: File;
  bid_doc?: File;
}

export interface FeedbackFormValues {
  final_score: number;
  ranking?: number;
  score_detail?: string;
  remark?: string;
}
