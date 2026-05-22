import { Button, Card, Empty, Popconfirm, Space, Spin, Tag } from "antd";
import dayjs from "dayjs";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
} from "@ant-design/icons";
import { PROJECT_STATUS_MAP } from "../constants";
import type { BiddingProjectListItem } from "../types";

interface ProjectMobileCardListProps {
  loading: boolean;
  items: BiddingProjectListItem[];
  onDetail: (id: number) => void;
  onEdit: (id: number) => void;
  onFeedback: (id: number) => void;
  onDelete: (id: number) => void;
}

export default function ProjectMobileCardList({
  loading,
  items,
  onDetail,
  onEdit,
  onFeedback,
  onDelete,
}: ProjectMobileCardListProps) {
  if (loading && items.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return <Empty description="暂无项目" className="py-8" />;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((record) => {
        const statusMeta = PROJECT_STATUS_MAP[record.status];
        return (
          <Card key={record.id} size="small" className="shadow-sm">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium text-base leading-snug break-words">{record.name}</div>
                <div className="text-gray-500 text-sm mt-1 truncate">{record.participating_units}</div>
              </div>
              <Tag color={statusMeta.color} className="shrink-0 m-0">
                {statusMeta.label}
              </Tag>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm text-gray-600 mb-3">
              <span>开标：{dayjs(record.bid_opening_at).format("MM-DD HH:mm")}</span>
              <span>附件：{record.attachment_count} 个</span>
              <span>得分：{record.final_score != null ? record.final_score.toFixed(2) : "-"}</span>
              <span>排名：{record.ranking ?? "-"}</span>
            </div>

            <Space wrap className="w-full">
              <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(record.id)}>
                详情
              </Button>
              <Button
                size="small"
                icon={<EditOutlined />}
                disabled={record.status === "completed"}
                onClick={() => onEdit(record.id)}
              >
                编辑
              </Button>
              <Button
                size="small"
                icon={<FileSearchOutlined />}
                disabled={record.status === "registered"}
                onClick={() => onFeedback(record.id)}
              >
                {record.status === "completed" ? "改反馈" : "填反馈"}
              </Button>
              <Popconfirm title="确定删除该项目？" onConfirm={() => onDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </Space>
          </Card>
        );
      })}
    </div>
  );
}
