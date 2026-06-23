/**
 * 与第三方招投标上传接口 `/api/v1/bidding/projects` 保持一致的字段名。
 * 前端经 `/wangjun` 代理访问，实际请求路径为 `/wangjun/api/v1/bidding/projects`。
 * 本地表单、API 与后续对接客户端应统一使用这些键名。
 */
export const THIRD_PARTY_BIDDING_FIELDS = {
  bid_file: "bid_file",
  project_id: "project_id",
  project_name: "project_name",
  third_party_file_name: "third_party_file_name",
  bid_opening_time: "bid_opening_time",
  evaluation_date: "evaluation_date",
  project_code: "project_code",
  db_id: "db_id",
} as const;

/** 第三方创建项目请求（multipart/form-data） */
export interface ThirdPartyProjectCreatePayload {
  bid_file: File;
  project_id?: string;
  project_name?: string;
  third_party_file_name?: string;
  bid_opening_time?: string;
  evaluation_date?: string;
}

/** 第三方创建项目响应中的 project 节点 */
export interface ThirdPartyProjectCreateResponse {
  project: {
    db_id: number;
    project_code: string;
    project_id?: string;
    project_name?: string;
    bid_opening_time?: string;
    evaluation_date?: string;
  };
}

export interface ThirdPartySubmissionAnalyzeResponse {
  status?: string;
  project_id?: string;
  project_code?: string;
  message?: string;
  submission_file?: {
    id: string;
    [key: string]: unknown;
  };
  report?: Record<string, unknown>;
  report_data?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ThirdPartyPublicSubmissionAnalyzeResponse {
  status?: string;
  message?: string;
  report?: Record<string, unknown>;
  report_data?: Record<string, unknown>;
  [key: string]: unknown;
}
