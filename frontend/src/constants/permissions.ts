export type PermissionModule = "menus" | "bidding" | "users" | "operation_logs";

export type PermissionActionMap = {
  menus: "dashboard" | "recharge_console" | "bidding_projects" | "users" | "operation_logs" | "permissions";
  bidding:
    | "view"
    | "create"
    | "edit"
    | "delete"
    | "feedback"
    | "preview"
    | "download"
    | "report_view"
    | "report_upload"
    | "report_json"
    | "report_page"
    | "report_download"
    | "analysis"
    | "sync";
  users: "view" | "create" | "edit" | "delete";
  operation_logs: "view";
};

export type PermissionsMap = {
  [K in PermissionModule]?: Partial<Record<PermissionActionMap[K], boolean>>;
};

export const MODULE_LABELS: Record<PermissionModule, string> = {
  menus: "菜单管理",
  bidding: "招投标项目",
  users: "用户管理",
  operation_logs: "操作日志",
};

export const ACTION_LABELS: Record<PermissionModule, Record<string, string>> = {
  menus: {
    dashboard: "Dashboard",
    recharge_console: "充值控制台",
    bidding_projects: "项目管理",
    users: "用户管理",
    operation_logs: "操作日志",
    permissions: "权限管理",
  },
  bidding: {
    view: "查看项目",
    create: "创建/登记",
    edit: "编辑",
    delete: "删除",
    feedback: "评审反馈",
    preview: "预览",
    download: "下载",
    report_view: "查看报告",
    report_upload: "上传报告",
    report_json: "上传JSON",
    report_page: "报告页",
    report_download: "下载报告",
    analysis: "分析",
    sync: "标为已同步",
  },
  users: {
    view: "查看",
    create: "创建",
    edit: "编辑",
    delete: "删除",
  },
  operation_logs: {
    view: "查看",
  },
};

export interface BiddingAccess {
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canFeedback: boolean;
  canPreview: boolean;
  canDownload: boolean;
  canReportView: boolean;
  canReportUpload: boolean;
  canReportJson: boolean;
  canReportPage: boolean;
  canReportDownload: boolean;
  canAnalysis: boolean;
  canSync: boolean;
}
