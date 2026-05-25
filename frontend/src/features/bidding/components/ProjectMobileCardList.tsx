import { Button, Card, Collapse, Empty, Popconfirm, Space, Spin, Tag } from "antd";
import dayjs from "dayjs";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { PROJECT_STATUS_MAP } from "../constants";
import type { BiddingProjectGroupTreeItem } from "../types";

interface ProjectMobileCardListProps {
  loading: boolean;
  groups: BiddingProjectGroupTreeItem[];
  onDetail: (id: number) => void;
  onEdit: (id: number) => void;
  onFeedback: (id: number) => void;
  onDelete: (id: number) => void;
  onEditGroup: (group: BiddingProjectGroupTreeItem) => void;
  onAddProject: (groupId: number) => void;
}

export default function ProjectMobileCardList({
  loading,
  groups,
  onDetail,
  onEdit,
  onFeedback,
  onDelete,
  onEditGroup,
  onAddProject,
}: ProjectMobileCardListProps) {
  if (loading && groups.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  if (!loading && groups.length === 0) {
    return <Empty description="暂无项目组" className="py-8" />;
  }

  return (
    <Collapse
      defaultActiveKey={groups.map((g) => String(g.id))}
      items={groups.map((group) => ({
        key: String(group.id),
        label: (
          <div className="flex items-center gap-2 min-w-0">
            <FolderOutlined className="text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{group.name}</div>
              <div className="text-xs text-gray-500">
                {dayjs(group.bid_opening_at).format("YYYY-MM-DD HH:mm")} · {group.children.length} 个项目 ·{" "}
                {group.attachment_count} 个附件
              </div>
            </div>
          </div>
        ),
        extra: (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            <Button type="link" size="small" onClick={() => onEditGroup(group)}>
              编辑组
            </Button>
            <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => onAddProject(group.id)}>
              添加
            </Button>
          </Space>
        ),
        children:
          group.children.length === 0 ? (
            <Empty description="组内暂无项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="flex flex-col gap-3">
              {group.children.map((record) => {
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
                      <span>得分：{record.final_score != null ? record.final_score.toFixed(2) : "-"}</span>
                      <span>排名：{record.ranking ?? "-"}</span>
                    </div>

                    <Space wrap className="w-full">
                      <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(record.id)}>
                        详情
                      </Button>
                      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>
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
          ),
      }))}
    />
  );
}
