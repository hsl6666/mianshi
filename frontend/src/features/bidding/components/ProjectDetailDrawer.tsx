import { useEffect, useState } from "react";
import { Button, Descriptions, Divider, Drawer, Space, Tag, Typography, Upload, message } from "antd";
import { DownloadOutlined, SyncOutlined, UploadOutlined } from "@ant-design/icons";
import { formatChinaTime } from "@/utils/date";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import {
  ACCEPTED_FILE_TYPES,
  ATTACHMENT_TYPE_MAP,
  PROJECT_STATUS_MAP,
  REPORT_STATUS_MAP,
  resolveReportStatus,
  THIRD_PARTY_SYNC_STATUS_MAP,
} from "../constants";
import {
  downloadBidVersionReport,
  downloadProjectAttachment,
  updateBidVersionAnalysisStatus,
  updateBidVersionThirdPartySyncStatus,
  uploadBidVersionReport,
} from "../api";
import AnalysisStatusSwitch from "./AnalysisStatusSwitch";
import BidFilePreviewLink from "./BidFilePreviewLink";
import EllipsisTooltip from "./EllipsisTooltip";
import type { BiddingProjectDetail, ProjectAttachment, ThirdPartySyncStatus } from "../types";
import { usePermission } from "@/hooks/usePermission";

interface ProjectDetailDrawerProps {
  open: boolean;
  project: BiddingProjectDetail | null;
  onClose: () => void;
}

export default function ProjectDetailDrawer({ open, project, onClose }: ProjectDetailDrawerProps) {
  const { isMobile, drawerProps } = useResponsiveOverlay();
  const { can } = usePermission();
  const canPreview = can("bidding", "preview");
  const canDownload = can("bidding", "download");
  const canAnalysis = can("bidding", "analysis");
  const canReportUpload = can("bidding", "report_upload");
  const canReportDownload = can("bidding", "report_download");
  const canSync = can("bidding", "sync");
  const [analysisStatusMap, setAnalysisStatusMap] = useState<Record<number, boolean>>({});
  const [syncStatusMap, setSyncStatusMap] = useState<Record<number, ThirdPartySyncStatus>>({});
  const [reportMap, setReportMap] = useState<
    Record<
      number,
      Pick<ProjectAttachment, "report_original_name" | "report_size_bytes" | "report_uploaded_at">
    >
  >({});

  useEffect(() => {
    if (!project) {
      setAnalysisStatusMap({});
      setSyncStatusMap({});
      setReportMap({});
      return;
    }
    const nextAnalysis: Record<number, boolean> = {};
    const nextSync: Record<number, ThirdPartySyncStatus> = {};
    const nextReport: Record<
      number,
      Pick<ProjectAttachment, "report_original_name" | "report_size_bytes" | "report_uploaded_at">
    > = {};
    project.companies.forEach((company) => {
      company.attachments.forEach((file) => {
        nextAnalysis[file.id] = file.analysis_status ?? false;
        nextSync[file.id] = file.third_party_sync_status ?? "unsynced";
        nextReport[file.id] = {
          report_original_name: file.report_original_name ?? null,
          report_size_bytes: file.report_size_bytes ?? null,
          report_uploaded_at: file.report_uploaded_at ?? null,
        };
      });
    });
    setAnalysisStatusMap(nextAnalysis);
    setSyncStatusMap(nextSync);
    setReportMap(nextReport);
  }, [project]);

  if (!project) return null;

  const statusMeta = PROJECT_STATUS_MAP[project.status];

  const handleProjectDownload = async (attachmentId: number, filename: string) => {
    try {
      await downloadProjectAttachment({ projectId: project.id, attachmentId, filename });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  const handleAnalysisStatusChange = async (attachmentId: number, analysisStatus: boolean) => {
    const previous = analysisStatusMap[attachmentId] ?? false;
    setAnalysisStatusMap((prev) => ({ ...prev, [attachmentId]: analysisStatus }));
    try {
      await updateBidVersionAnalysisStatus({ attachmentId, analysisStatus });
      message.success(analysisStatus ? "已标记为已分析" : "已标记为未分析");
    } catch (error) {
      setAnalysisStatusMap((prev) => ({ ...prev, [attachmentId]: previous }));
      message.error(error instanceof Error ? error.message : "更新分析状态失败");
    }
  };

  const handleSyncStatusChange = async (attachmentId: number, thirdPartySyncStatus: ThirdPartySyncStatus) => {
    const previous = syncStatusMap[attachmentId] ?? "unsynced";
    setSyncStatusMap((prev) => ({ ...prev, [attachmentId]: thirdPartySyncStatus }));
    try {
      await updateBidVersionThirdPartySyncStatus({ attachmentId, thirdPartySyncStatus });
      message.success(thirdPartySyncStatus === "synced" ? "已标记为已同步" : "已标记为未同步");
    } catch (error) {
      setSyncStatusMap((prev) => ({ ...prev, [attachmentId]: previous }));
      message.error(error instanceof Error ? error.message : "更新三方同步状态失败");
    }
  };

  const handleUploadReport = async (attachmentId: number, file: File) => {
    try {
      const next = await uploadBidVersionReport({ attachmentId, file });
      setReportMap((prev) => ({
        ...prev,
        [attachmentId]: {
          report_original_name: next.report_original_name ?? null,
          report_size_bytes: next.report_size_bytes ?? null,
          report_uploaded_at: next.report_uploaded_at ?? null,
        },
      }));
      setAnalysisStatusMap((prev) => ({ ...prev, [attachmentId]: next.analysis_status ?? true }));
      message.success("报告已上传");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传报告失败");
    }
  };

  const handleDownloadReport = async (attachmentId: number, filename: string | null | undefined) => {
    if (!filename) {
      message.warning("暂无报告可下载");
      return;
    }
    try {
      await downloadBidVersionReport({ attachmentId, filename });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载报告失败");
    }
  };

  return (
    <Drawer
      title="项目详情"
      width={isMobile ? undefined : 560}
      open={open}
      onClose={onClose}
      {...drawerProps}
    >
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="所属项目">
          <EllipsisTooltip title={project.project_name}>{project.project_name}</EllipsisTooltip>
        </Descriptions.Item>
        <Descriptions.Item label="项目名称">
          <EllipsisTooltip title={project.name}>{project.name}</EllipsisTooltip>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="参加单位">
          <EllipsisTooltip
            title={
              project.companies.length > 0
                ? project.companies.map((c) => c.name).join("、")
                : project.participating_units || "-"
            }
          >
            {project.companies.length > 0
              ? project.companies.map((c) => c.name).join("、")
              : project.participating_units || "-"}
          </EllipsisTooltip>
        </Descriptions.Item>
        <Descriptions.Item label="开标时间">
          {formatChinaTime(project.bid_opening_time, "YYYY-MM-DD HH:mm")}
        </Descriptions.Item>
        <Descriptions.Item label="招标文件">
          <Space direction="vertical" size={4}>
            {project.attachments.length === 0 ? (
              <span className="text-gray-400">暂无招标文件</span>
            ) : canDownload ? (
              project.attachments.map((file) => (
                <EllipsisTooltip key={file.id} title={file.original_name}>
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      handleProjectDownload(file.id, file.original_name);
                    }}
                  >
                    {file.original_name}
                  </a>
                </EllipsisTooltip>
              ))
            ) : (
              project.attachments.map((file) => (
                <EllipsisTooltip key={file.id} title={file.original_name}>
                  <span>{file.original_name}</span>
                </EllipsisTooltip>
              ))
            )}
          </Space>
        </Descriptions.Item>
      </Descriptions>

      <Divider plain>投标文件版本（按参加单位分组）</Divider>
      {project.companies.length === 0 ? (
        <Typography.Text type="secondary">暂无投标文件，请通过登记项目上传。</Typography.Text>
      ) : (
        <Space direction="vertical" size="middle" className="w-full">
          {project.companies.map((company) => (
            <div key={company.id} className="rounded-lg border border-gray-100 p-3">
              <Typography.Text strong>
                <EllipsisTooltip title={company.name}>{company.name}</EllipsisTooltip>
              </Typography.Text>
              {company.feedback && (
                <div className="mt-2 text-sm text-gray-600 space-y-1">
                  <div>最终得分：{company.feedback.final_score}</div>
                  <div>排名：{company.feedback.ranking ?? "-"}</div>
                  {company.feedback.score_detail && (
                    <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                      打分明细：{company.feedback.score_detail}
                    </Typography.Paragraph>
                  )}
                  {company.feedback.remark && (
                    <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                      备注：{company.feedback.remark}
                    </Typography.Paragraph>
                  )}
                </div>
              )}
              <div className="mt-2 space-y-1 text-sm">
                {company.attachments.length === 0 ? (
                  <span className="text-gray-400">暂无{ATTACHMENT_TYPE_MAP.bid_doc}</span>
                ) : (
                  company.attachments.map((file) => {
                    const timeText = formatChinaTime(file.created_at, "YYYY-MM-DD HH:mm");
                    const prefix = `v${file.version_number ?? "-"} · `;
                    const suffix = `（${timeText}）`;
                    const syncStatus = syncStatusMap[file.id] ?? file.third_party_sync_status ?? "unsynced";
                    const syncMeta = THIRD_PARTY_SYNC_STATUS_MAP[syncStatus];
                    const nextSyncStatus: ThirdPartySyncStatus =
                      syncStatus === "synced" ? "unsynced" : "synced";
                    const report = reportMap[file.id] ?? {
                      report_original_name: file.report_original_name ?? null,
                      report_size_bytes: file.report_size_bytes ?? null,
                      report_uploaded_at: file.report_uploaded_at ?? null,
                    };
                    const hasReport = Boolean(report.report_original_name || report.report_uploaded_at);
                    const reportMeta = REPORT_STATUS_MAP[
                      resolveReportStatus({
                        report_status: file.report_status ?? "pending",
                        report_has_data: hasReport,
                      })
                    ];
                    return (
                      <div key={file.id} className="space-y-1">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="shrink-0 text-gray-500">{prefix}</span>
                          {canPreview ? (
                            <BidFilePreviewLink attachmentId={file.id} filename={file.original_name} />
                          ) : (
                            <span>{file.original_name}</span>
                          )}
                          <span className="shrink-0 text-gray-500">{suffix}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-5 text-xs text-gray-500">
                          <span>分析状态</span>
                          <AnalysisStatusSwitch
                            value={analysisStatusMap[file.id] ?? file.analysis_status ?? false}
                            disabled={!canAnalysis}
                            onChange={(checked) => handleAnalysisStatusChange(file.id, checked)}
                          />
                        </div>
                        {canSync && (
                          <div className="flex flex-wrap items-center gap-2 pl-5 text-xs text-gray-500">
                            <span>三方同步状态</span>
                            <Tag color={syncMeta.color} className="m-0">
                              {syncMeta.label}
                            </Tag>
                            <Button
                              type="link"
                              size="small"
                              className="!px-0"
                              icon={<SyncOutlined />}
                              onClick={() => handleSyncStatusChange(file.id, nextSyncStatus)}
                            >
                              {nextSyncStatus === "synced" ? "标为已同步" : "标为未同步"}
                            </Button>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-2 pl-5 text-xs text-gray-500">
                          <span>报告状态</span>
                          <Tag color={reportMeta.color} className="m-0">
                            {reportMeta.label}
                          </Tag>
                          {canReportUpload && (
                            <Upload
                              accept={ACCEPTED_FILE_TYPES}
                              showUploadList={false}
                              beforeUpload={(uploadFile) => {
                                void handleUploadReport(file.id, uploadFile);
                                return false;
                              }}
                            >
                              <Button type="link" size="small" className="!px-0" icon={<UploadOutlined />}>
                                上传报告
                              </Button>
                            </Upload>
                          )}
                          {hasReport && canReportDownload && (
                            <Button
                              type="link"
                              size="small"
                              className="!px-0"
                              icon={<DownloadOutlined />}
                              onClick={() => handleDownloadReport(file.id, report.report_original_name)}
                            >
                              下载报告
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </Space>
      )}
    </Drawer>
  );
}
