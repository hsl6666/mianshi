export type ProjectStatus = "registered" | "awaiting_feedback" | "completed";

export type ThirdPartySyncStatus = "unsynced" | "synced";

export type ReportStatus = "pending" | "analyzing" | "completed" | "failed";

export type AttachmentType = "tender_doc" | "bid_doc";

export type RowType = "group" | "project" | "company" | "version";

export interface ProjectAttachment {
  id: number;
  attachment_type: AttachmentType;
  original_name: string;
  third_party_file_name?: string | null;
  size_bytes: number;
  version_number?: number | null;
  analysis_status?: boolean;
  report_status?: ReportStatus;
  third_party_sync_status?: ThirdPartySyncStatus;
  third_party_submission_file_id?: string | null;
  report_original_name?: string | null;
  report_size_bytes?: number | null;
  report_uploaded_at?: string | null;
  report_has_data?: boolean;
  report_title?: string | null;
  report_final_score?: number | null;
  report_project_amount?: number | null;
  report_rating?: string | null;
  report_feedback?: string | null;
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
  db_id: number;
  project_name: string;
  bid_opening_time: string;
  project_id?: string | null;
  project_code?: string | null;
  third_party_db_id?: string | null;
  evaluation_date?: string | null;
  created_at: string;
  updated_at: string;
  attachment_count: number;
  project_count: number;
}

export interface BiddingProjectGroupDetail {
  db_id: number;
  project_name: string;
  bid_opening_time: string;
  project_id?: string | null;
  project_code?: string | null;
  third_party_db_id?: string | null;
  evaluation_date?: string | null;
  created_at: string;
  updated_at: string;
  attachments: ProjectAttachment[];
  third_party_synced?: boolean | null;
  third_party_sync_error?: string | null;
}

export interface BidVersionListItem {
  row_type: "version";
  id: number;
  company_id: number;
  project_id: number;
  version_number: number;
  original_name: string;
  third_party_file_name?: string | null;
  size_bytes: number;
  analysis_status: boolean;
  report_status: ReportStatus;
  third_party_sync_status: ThirdPartySyncStatus;
  third_party_submission_file_id?: string | null;
  report_original_name: string | null;
  report_size_bytes: number | null;
  report_uploaded_at: string | null;
  report_has_data: boolean;
  report_title: string | null;
  report_final_score: number | null;
  report_project_amount: number | null;
  report_rating: string | null;
  report_feedback: string | null;
  created_at: string;
}

export interface BiddingCompanyListItem {
  row_type: "company";
  id: number;
  project_id: number;
  name: string;
  bid_opening_time: string;
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
  db_id: number;
  name: string;
  participating_units: string;
  bid_opening_time: string;
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
  db_id: number;
  project_name: string;
  bid_opening_time: string;
  project_id?: string | null;
  project_code?: string | null;
  evaluation_date?: string | null;
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
  db_id: number;
  project_name: string;
  name: string;
  participating_units: string;
  bid_opening_time: string;
  project_id?: string | null;
  project_code?: string | null;
  third_party_db_id?: string | null;
  evaluation_date?: string | null;
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
  dbId: number;
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
  db_id?: number;
  project_name?: string;
  bid_opening_time?: string;
  project_id?: string;
  third_party_file_name?: string;
  evaluation_date?: string;
  name?: string;
  participating_units?: string;
  tender_doc?: File;
  bid_file?: File;
}

export interface GroupFormValues {
  project_name: string;
  bid_opening_time: string;
  project_id?: string;
  evaluation_date?: string;
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

export interface TechnicalReportProjectInfo {
  project_name: string;
  project_no?: string | null;
  bidder_name?: string | null;
  review_date?: string | null;
  construction_scale?: string | null;
  construction_location?: string | null;
  contract_estimate?: string | null;
  duration_quality?: string | null;
  bid_method?: string | null;
  technical_full_score?: number | string | null;
}

export interface TechnicalReportScoreSummary {
  final_score: number;
  full_score: number;
  rating?: string | null;
  score_range?: string | null;
  confidence?: string | null;
  submit_advice?: string | null;
}

export interface TechnicalReportDimensionScore {
  name: string;
  score: number;
  max_score: number;
  comment?: string | null;
}

export interface TechnicalReportIssue {
  title: string;
  priority: "A" | "B" | "C";
  severity: "high" | "medium" | "low";
  location?: string | null;
  problem?: string | null;
  reason?: string | null;
  suggestion?: string | null;
  expected_score_gain?: string | null;
  related_dimensions: string[];
}

export interface TechnicalReportPriorityTasks {
  A: string[];
  B: string[];
  C: string[];
}

export interface TechnicalReportScoreGainForecast {
  finish_A?: string | null;
  finish_AB?: string | null;
  finish_ABC?: string | null;
  expected_after_revision?: string | null;
}

export interface TechnicalReviewReportData {
  report_title: string;
  subtitle?: string | null;
  project_info: TechnicalReportProjectInfo;
  score_summary: TechnicalReportScoreSummary;
  dimension_scores: TechnicalReportDimensionScore[];
  issues: TechnicalReportIssue[];
  priority_tasks: TechnicalReportPriorityTasks;
  score_gain_forecast: TechnicalReportScoreGainForecast;
  review_suggestion?: string | null;
  disclaimer?: string | null;
}

export interface TechnicalReviewReportOut {
  attachment_id: number;
  report_uploaded_at: string;
  report_data: TechnicalReviewReportData;
  context?: TechnicalReviewReportContext | null;
}

export interface TechnicalReviewReportContext {
  company_name?: string | null;
  owner_username?: string | null;
  owner_display_name?: string | null;
}

export interface TechnicalReviewReportRawOut {
  attachment_id: number;
  report_uploaded_at: string;
  report_data: Record<string, unknown>;
  context?: TechnicalReviewReportContext | null;
}
