import { useEffect, useState } from "react";
import { Descriptions, Divider, Drawer, Space, Tag, Typography, message } from "antd";
import { formatChinaTime } from "@/utils/date";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import { ATTACHMENT_TYPE_MAP, PROJECT_STATUS_MAP } from "../constants";
import { downloadProjectAttachment, updateBidVersionAnalysisStatus } from "../api";
import AnalysisStatusSwitch from "./AnalysisStatusSwitch";
import BidFilePreviewLink from "./BidFilePreviewLink";
import EllipsisTooltip from "./EllipsisTooltip";
import type { BiddingProjectDetail } from "../types";
import { useAuthStore } from "@/store/authStore";

interface ProjectDetailDrawerProps {
  open: boolean;
  project: BiddingProjectDetail | null;
  onClose: () => void;
}

export default function ProjectDetailDrawer({ open, project, onClose }: ProjectDetailDrawerProps) {
  const { isMobile, drawerProps } = useResponsiveOverlay();
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const [analysisStatusMap, setAnalysisStatusMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!project) {
      setAnalysisStatusMap({});
      return;
    }
    const next: Record<number, boolean> = {};
    project.companies.forEach((company) => {
      company.attachments.forEach((file) => {
        next[file.id] = file.analysis_status ?? false;
      });
    });
    setAnalysisStatusMap(next);
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

  return (
    <Drawer
      title="项目详情"
      width={isMobile ? undefined : 560}
      open={open}
      onClose={onClose}
      {...drawerProps}
    >
      <Descriptions column={1} bordered size="small">
        <Descriptions.Item label="所属项目组">
          <EllipsisTooltip title={project.group_name}>{project.group_name}</EllipsisTooltip>
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
          {formatChinaTime(project.bid_opening_at, "YYYY-MM-DD HH:mm")}
        </Descriptions.Item>
        <Descriptions.Item label="招标文件">
          <Space direction="vertical" size={4}>
            {project.attachments.length === 0 ? (
              <span className="text-gray-400">暂无招标文件</span>
            ) : (
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
                    return (
                      <div key={file.id} className="space-y-1">
                        <div className="flex min-w-0 items-center gap-1">
                          <span className="shrink-0 text-gray-500">{prefix}</span>
                          <BidFilePreviewLink attachmentId={file.id} filename={file.original_name} />
                          <span className="shrink-0 text-gray-500">{suffix}</span>
                        </div>
                        <div className="flex items-center gap-2 pl-5 text-xs text-gray-500">
                          <span>分析状态</span>
                          <AnalysisStatusSwitch
                            value={analysisStatusMap[file.id] ?? file.analysis_status ?? false}
                            disabled={!isSuperAdmin}
                            onChange={(checked) => handleAnalysisStatusChange(file.id, checked)}
                          />
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
