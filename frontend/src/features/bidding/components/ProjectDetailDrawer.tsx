import { Descriptions, Drawer, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import { ATTACHMENT_TYPE_MAP, PROJECT_STATUS_MAP } from "../constants";
import { downloadProjectAttachment } from "../api";
import type { BiddingProjectDetail } from "../types";

interface ProjectDetailDrawerProps {
  open: boolean;
  project: BiddingProjectDetail | null;
  onClose: () => void;
}

export default function ProjectDetailDrawer({ open, project, onClose }: ProjectDetailDrawerProps) {
  const { isMobile, drawerProps } = useResponsiveOverlay();

  if (!project) return null;

  const statusMeta = PROJECT_STATUS_MAP[project.status];
  const handleDownload = async (attachmentId: number, filename: string) => {
    try {
      await downloadProjectAttachment({ projectId: project.id, attachmentId, filename });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载失败");
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
        <Descriptions.Item label="所属项目组">{project.group_name}</Descriptions.Item>
        <Descriptions.Item label="项目名称">{project.name}</Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="参加单位">{project.participating_units}</Descriptions.Item>
        <Descriptions.Item label="开标时间">
          {dayjs(project.bid_opening_at).format("YYYY-MM-DD HH:mm")}
        </Descriptions.Item>
        <Descriptions.Item label="项目附件">
          <Space direction="vertical" size={4}>
            {project.attachments.length === 0 ? (
              <span className="text-gray-400">暂无附件</span>
            ) : (
              project.attachments.map((file) => (
                <a
                  key={file.id}
                  href="#"
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDownload(file.id, file.original_name);
                  }}
                >
                  {ATTACHMENT_TYPE_MAP[file.attachment_type]}：{file.original_name}
                </a>
              ))
            )}
          </Space>
        </Descriptions.Item>
        {project.feedback && (
          <>
            <Descriptions.Item label="最终得分">{project.feedback.final_score}</Descriptions.Item>
            <Descriptions.Item label="排名">{project.feedback.ranking ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="打分明细">
              <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                {project.feedback.score_detail || "-"}
              </Typography.Paragraph>
            </Descriptions.Item>
            <Descriptions.Item label="备注">
              <Typography.Paragraph className="!mb-0 whitespace-pre-wrap">
                {project.feedback.remark || "-"}
              </Typography.Paragraph>
            </Descriptions.Item>
          </>
        )}
      </Descriptions>
    </Drawer>
  );
}
