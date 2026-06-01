import { useEffect, useState } from "react";
import { Button, Card, Collapse, Empty, Popconfirm, Space, Spin, Tag, Tooltip, Upload } from "antd";
import { formatChinaTime } from "@/utils/date";
import {
  BankOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FolderOutlined,
  HistoryOutlined,
  PlusOutlined,
  SyncOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import BidFilePreviewLink from "./BidFilePreviewLink";
import AnalysisStatusSwitch from "./AnalysisStatusSwitch";
import EllipsisTooltip from "./EllipsisTooltip";
import {
  ACCEPTED_FILE_TYPES,
  PROJECT_STATUS_MAP,
  REPORT_STATUS_MAP,
  THIRD_PARTY_SYNC_STATUS_MAP,
} from "../constants";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
  ThirdPartySyncStatus,
} from "../types";

interface ProjectMobileCardListProps {
  loading: boolean;
  groups: BiddingProjectGroupTreeItem[];
  onDetail: (id: number) => void;
  onEdit: (id: number) => void;
  onFeedback: (company: BiddingCompanyListItem, project: BiddingProjectListItem) => void;
  onDelete: (id: number) => void;
  onEditGroup: (group: BiddingProjectGroupTreeItem) => void;
  onDownloadGroupTender: (group: BiddingProjectGroupTreeItem) => void;
  onAddProject: (groupId: number) => void;
  onUploadRevision: (
    groupId: number,
    project: Pick<BiddingProjectListItem, "name" | "bid_opening_at">,
    company: Pick<BiddingCompanyListItem, "name">,
  ) => void;
  onDeleteCompany: (id: number) => void;
  onPreviewVersion: (record: BidVersionListItem) => void;
  onDownloadVersion: (record: BidVersionListItem) => void;
  onDownloadVersionReport: (record: BidVersionListItem) => void;
  onUploadVersionReport: (record: BidVersionListItem, file: File) => void;
  onAnalysisStatusChange: (record: BidVersionListItem, analysisStatus: boolean) => void;
  onThirdPartySyncStatusChange: (
    record: BidVersionListItem,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => void;
  isSuperAdmin: boolean;
  onDeleteVersion: (id: number) => void;
}

function hasVersionReport(record: Pick<BidVersionListItem, "report_original_name" | "report_uploaded_at">) {
  return Boolean(record.report_original_name || record.report_uploaded_at);
}

export default function ProjectMobileCardList({
  loading,
  groups,
  onDetail,
  onEdit,
  onFeedback,
  onDelete,
  onEditGroup,
  onDownloadGroupTender,
  onAddProject,
  onUploadRevision,
  onDeleteCompany,
  onPreviewVersion,
  onDownloadVersion,
  onDownloadVersionReport,
  onUploadVersionReport,
  onAnalysisStatusChange,
  onThirdPartySyncStatusChange,
  isSuperAdmin,
  onDeleteVersion,
}: ProjectMobileCardListProps) {
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    setActiveKeys(groups[0] ? [String(groups[0].id)] : []);
  }, [groups]);

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
      activeKey={activeKeys}
      onChange={(keys) => setActiveKeys(keys as string[])}
      items={groups.map((group) => ({
        key: String(group.id),
        label: (
          <div className="flex items-center gap-2 min-w-0">
            <FolderOutlined className="text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <EllipsisTooltip title={group.name}>
                <div className="font-medium">{group.name}</div>
              </EllipsisTooltip>
              <div className="text-xs text-gray-500">
                {formatChinaTime(group.bid_opening_at, "YYYY-MM-DD HH:mm")} · {group.children.length} 个项目 ·{" "}
                {group.attachment_count} 个附件
              </div>
            </div>
          </div>
        ),
        extra: (
          <Space size={4} onClick={(e) => e.stopPropagation()}>
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              disabled={
                !group.attachments.some((file) => file.attachment_type === "tender_doc") &&
                !group.children.some((project) =>
                  project.attachments.some((file) => file.attachment_type === "tender_doc"),
                )
              }
              onClick={() => onDownloadGroupTender(group)}
            >
              下载招标文件
            </Button>
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
                        <EllipsisTooltip title={record.name}>
                          <div className="font-medium text-base leading-snug">{record.name}</div>
                        </EllipsisTooltip>
                        <EllipsisTooltip
                          title={
                            record.company_count > 0
                              ? `${record.company_count} 家 · ${record.participating_units}`
                              : record.participating_units || "暂无参加单位"
                          }
                        >
                          <div className="text-gray-500 text-sm mt-1">
                            {record.company_count > 0
                              ? `${record.company_count} 家 · ${record.participating_units}`
                              : record.participating_units || "暂无参加单位"}
                          </div>
                        </EllipsisTooltip>
                      </div>
                      <Space size={4} className="shrink-0">
                        <Tag color={statusMeta.color} className="m-0">
                          {statusMeta.label}
                        </Tag>
                      </Space>
                    </div>

                    {record.children.length > 0 && (
                      <div className="mb-3 flex flex-col gap-2 rounded-lg bg-gray-50 p-2">
                        {record.children.map((company) => (
                          <div
                            key={company.id}
                            className="border-b border-gray-100 pb-2 last:border-0 last:pb-0"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1 text-sm font-medium min-w-0 flex-1">
                                <BankOutlined className="text-emerald-600 shrink-0" />
                                <EllipsisTooltip title={company.name}>{company.name}</EllipsisTooltip>
                                <Tag className="m-0 shrink-0">{company.version_count} 版</Tag>
                              </div>
                              <Space size={0}>
                                <Button
                                  type="link"
                                  size="small"
                                  icon={<FileSearchOutlined />}
                                  disabled={company.status === "registered"}
                                  onClick={() => onFeedback(company, record)}
                                />
                                <Tooltip title="上传新版投标文件">
                                  <Button
                                    type="link"
                                    size="small"
                                    icon={<HistoryOutlined />}
                                    onClick={() => onUploadRevision(group.id, record, company)}
                                  />
                                </Tooltip>
                                <Popconfirm
                                  title="删除该单位及全部版本？"
                                  onConfirm={() => onDeleteCompany(company.id)}
                                >
                                  <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                                </Popconfirm>
                              </Space>
                            </div>
                            <div className="mt-1 pl-5 space-y-1">
                              {company.children.map((version) => {
                                const syncMeta =
                                  THIRD_PARTY_SYNC_STATUS_MAP[version.third_party_sync_status ?? "unsynced"];
                                const reportMeta =
                                  REPORT_STATUS_MAP[hasVersionReport(version) ? "uploaded" : "pending"];
                                const nextSyncStatus: ThirdPartySyncStatus =
                                  version.third_party_sync_status === "synced" ? "unsynced" : "synced";

                                return (
                                  <div key={version.id} className="flex flex-col gap-1 text-xs text-gray-600">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 flex-1 items-center">
                                        <span className="shrink-0">v{version.version_number} · </span>
                                        <BidFilePreviewLink
                                          attachmentId={version.id}
                                          filename={version.original_name}
                                        />
                                      </div>
                                      <Space size={0}>
                                        <Tooltip title="预览">
                                          <Button
                                            type="link"
                                            size="small"
                                            icon={<EyeOutlined />}
                                            onClick={() => onPreviewVersion(version)}
                                          />
                                        </Tooltip>
                                        <Tooltip title="下载投标文件">
                                          <Button
                                            type="link"
                                            size="small"
                                            icon={<DownloadOutlined />}
                                            onClick={() => onDownloadVersion(version)}
                                          />
                                        </Tooltip>
                                        {isSuperAdmin && (
                                          <Tooltip
                                            title={nextSyncStatus === "synced" ? "标为已同步" : "标为未同步"}
                                          >
                                            <Button
                                              type="link"
                                              size="small"
                                              icon={<SyncOutlined />}
                                              onClick={() =>
                                                onThirdPartySyncStatusChange(version, nextSyncStatus)
                                              }
                                            />
                                          </Tooltip>
                                        )}
                                        {isSuperAdmin && (
                                          <Upload
                                            accept={ACCEPTED_FILE_TYPES}
                                            showUploadList={false}
                                            beforeUpload={(file) => {
                                              void onUploadVersionReport(version, file);
                                              return false;
                                            }}
                                          >
                                            <Tooltip title="上传报告">
                                              <Button type="link" size="small" icon={<UploadOutlined />} />
                                            </Tooltip>
                                          </Upload>
                                        )}
                                        {hasVersionReport(version) && (
                                          <Tooltip title="下载报告">
                                            <Button
                                              type="link"
                                              size="small"
                                              icon={<DownloadOutlined />}
                                              onClick={() => onDownloadVersionReport(version)}
                                            />
                                          </Tooltip>
                                        )}
                                        <Popconfirm
                                          title="删除该版本？"
                                          onConfirm={() => onDeleteVersion(version.id)}
                                        >
                                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                                        </Popconfirm>
                                      </Space>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pl-5">
                                      <span className="text-gray-500">分析状态</span>
                                      <AnalysisStatusSwitch
                                        value={version.analysis_status}
                                        disabled={!isSuperAdmin}
                                        onChange={(checked) => onAnalysisStatusChange(version, checked)}
                                      />
                                      <Tag color={syncMeta.color} className="m-0">
                                        {syncMeta.label}
                                      </Tag>
                                      <Tag color={reportMeta.color} className="m-0">
                                        报告{reportMeta.label}
                                      </Tag>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Space wrap className="w-full">
                      <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(record.id)}>
                        详情
                      </Button>
                      <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>
                        编辑
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
