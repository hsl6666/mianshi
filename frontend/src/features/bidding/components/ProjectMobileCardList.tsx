import { useEffect, useMemo, useState } from "react";
import { Button, Card, Collapse, Empty, Popconfirm, Space, Spin, Tag, Tooltip, Upload } from "antd";
import {
  BankOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
  CalendarOutlined,
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
  resolveReportStatus,
  THIRD_PARTY_SYNC_STATUS_MAP,
} from "../constants";
import type { BiddingAccess } from "@/constants/permissions";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
  ThirdPartySyncStatus,
} from "../types";
import { buildDateTree } from "../utils/buildDateTree";

interface ProjectMobileCardListProps {
  loading: boolean;
  groups: BiddingProjectGroupTreeItem[];
  onDetail: (id: number) => void;
  onEdit: (id: number) => void;
  onFeedback: (company: BiddingCompanyListItem, project: BiddingProjectListItem) => void;
  onDelete: (id: number) => void;
  canDeleteGroup: boolean;
  onDeleteGroup: (group: BiddingProjectGroupTreeItem) => void;
  onEditGroup: (group: BiddingProjectGroupTreeItem) => void;
  onDownloadGroupTender: (group: BiddingProjectGroupTreeItem) => void;
  onAddProject: (groupId: number) => void;
  onUploadRevision: (
    groupId: number,
    project: Pick<BiddingProjectListItem, "name" | "bid_opening_time">,
    company: Pick<BiddingCompanyListItem, "name">,
  ) => void;
  onDeleteCompany: (id: number) => void;
  onPreviewVersion: (record: BidVersionListItem) => void;
  onDownloadVersion: (record: BidVersionListItem) => void;
  onDownloadVersionReport: (record: BidVersionListItem) => void;
  onOpenVersionReport: (record: BidVersionListItem) => void;
  onUploadVersionReport: (record: BidVersionListItem, file: File) => void;
  onAnalysisStatusChange: (record: BidVersionListItem, analysisStatus: boolean) => void;
  onThirdPartySyncStatusChange: (
    record: BidVersionListItem,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => void;
  access: BiddingAccess;
  onDeleteVersion: (id: number) => void;
}

function hasVersionReport(record: Pick<BidVersionListItem, "report_has_data">) {
  return Boolean(record.report_has_data);
}

export default function ProjectMobileCardList({
  loading,
  groups,
  onDetail,
  onEdit,
  onFeedback,
  onDelete,
  canDeleteGroup,
  onDeleteGroup,
  onEditGroup,
  onDownloadGroupTender,
  onAddProject,
  onUploadRevision,
  onDeleteCompany,
  onPreviewVersion,
  onDownloadVersion,
  onDownloadVersionReport,
  onOpenVersionReport,
  onUploadVersionReport,
  onAnalysisStatusChange,
  onThirdPartySyncStatusChange,
  access,
  onDeleteVersion,
}: ProjectMobileCardListProps) {
  const dateTree = useMemo(() => buildDateTree(groups), [groups]);
  const [activeKeys, setActiveKeys] = useState<string[]>([]);

  useEffect(() => {
    setActiveKeys(dateTree[0] ? [dateTree[0].dateKey] : []);
  }, [dateTree]);

  if (loading && groups.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    );
  }

  if (!loading && dateTree.length === 0) {
    return <Empty description="暂无项目数据" className="py-8" />;
  }

  return (
    <Collapse
      activeKey={activeKeys}
      onChange={(keys) => setActiveKeys(keys as string[])}
      items={dateTree.map((dateNode) => ({
        key: dateNode.dateKey,
        label: (
          <div className="flex items-center gap-2 min-w-0">
            <CalendarOutlined className="text-blue-500 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="font-medium">{dateNode.dateKey}</div>
              <div className="text-xs text-gray-500">{dateNode.projects.length} 个项目</div>
            </div>
          </div>
        ),
        children:
          dateNode.projects.length === 0 ? (
            <Empty description="该开标日暂无项目" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <div className="flex flex-col gap-3">
              {dateNode.projects.map((projectItem) => {
                const group = groups.find((item) => item.db_id === projectItem.dbId);
                if (!group) return null;
                const record = projectItem.project;
                if (!record) {
                  return (
                    <Card key={projectItem.key} size="small" className="shadow-sm">
                      <EllipsisTooltip title={projectItem.projectName}>
                        <div className="font-medium">{projectItem.projectName}</div>
                      </EllipsisTooltip>
                      <div className="mt-2 text-sm text-gray-500">暂无参加单位</div>
                      <Space wrap className="mt-3">
                        <Button size="small" onClick={() => onEditGroup(group)}>
                          编辑项目
                        </Button>
                        <Button size="small" icon={<PlusOutlined />} onClick={() => onAddProject(group.db_id)}>
                          添加参加单位
                        </Button>
                        {canDeleteGroup && (
                          <Popconfirm
                            title="删除该项目组？"
                            description="会删除项目组下的参加单位和文件版本。"
                            onConfirm={() => onDeleteGroup(group)}
                          >
                            <Button size="small" danger icon={<DeleteOutlined />}>
                              删除项目组
                            </Button>
                          </Popconfirm>
                        )}
                      </Space>
                    </Card>
                  );
                }
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
                                    onClick={() => onUploadRevision(group.db_id, record, company)}
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
                                  REPORT_STATUS_MAP[resolveReportStatus(version)];
                                const nextSyncStatus: ThirdPartySyncStatus =
                                  version.third_party_sync_status === "synced" ? "unsynced" : "synced";

                                return (
                                  <div key={version.id} className="flex flex-col gap-1 text-xs text-gray-600">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 flex-1 items-center">
                                        <span className="shrink-0">v{version.version_number} · </span>
                                        {access.canPreview ? (
                                          <BidFilePreviewLink
                                            attachmentId={version.id}
                                            filename={version.original_name}
                                          />
                                        ) : (
                                          <EllipsisTooltip title={version.original_name}>
                                            <span>{version.original_name}</span>
                                          </EllipsisTooltip>
                                        )}
                                      </div>
                                      <Space size={0}>
                                        {access.canPreview && (
                                          <Tooltip title="预览">
                                            <Button
                                              type="link"
                                              size="small"
                                              icon={<EyeOutlined />}
                                              onClick={() => onPreviewVersion(version)}
                                            />
                                          </Tooltip>
                                        )}
                                        {access.canDownload && (
                                          <Tooltip title="下载投标文件">
                                            <Button
                                              type="link"
                                              size="small"
                                              icon={<DownloadOutlined />}
                                              onClick={() => onDownloadVersion(version)}
                                            />
                                          </Tooltip>
                                        )}
                                        {access.canSync && (
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
                                        {hasVersionReport(version)
                                          ? access.canReportView && (
                                              <Tooltip title="查看报告">
                                                <Button
                                                  type="link"
                                                  size="small"
                                                  icon={<FileSearchOutlined />}
                                                  onClick={() => onOpenVersionReport(version)}
                                                />
                                              </Tooltip>
                                            )
                                          : access.canReportUpload && (
                                              <Upload
                                                accept={ACCEPTED_FILE_TYPES}
                                                showUploadList={false}
                                                beforeUpload={(file) => {
                                                  void onUploadVersionReport(version, file);
                                                  return false;
                                                }}
                                              >
                                                <Tooltip title="上传报告文件">
                                                  <Button type="link" size="small" icon={<UploadOutlined />} />
                                                </Tooltip>
                                              </Upload>
                                            )}
                                        {version.report_original_name && access.canReportDownload && (
                                          <Tooltip title="下载报告">
                                            <Button
                                              type="link"
                                              size="small"
                                              icon={<DownloadOutlined />}
                                              onClick={() => onDownloadVersionReport(version)}
                                            />
                                          </Tooltip>
                                        )}
                                        {access.canDelete && (
                                          <Popconfirm
                                            title="删除该版本？"
                                            onConfirm={() => onDeleteVersion(version.id)}
                                          >
                                            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                                          </Popconfirm>
                                        )}
                                      </Space>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 pl-5">
                                      <span className="text-gray-500">分析状态</span>
                                      <AnalysisStatusSwitch
                                        value={version.analysis_status}
                                        disabled={!access.canAnalysis}
                                        onChange={(checked) => onAnalysisStatusChange(version, checked)}
                                      />
                                      {access.canSync && (
                                        <>
                                          <span className="text-gray-500">三方同步状态</span>
                                          <Tag color={syncMeta.color} className="m-0">
                                            {syncMeta.label}
                                          </Tag>
                                        </>
                                      )}
                                      <Tag color={reportMeta.color} className="m-0">
                                        报告{reportMeta.label}
                                      </Tag>
                                      {version.report_final_score != null && (
                                        <Tag color="orange" className="m-0">
                                          {version.report_final_score}分
                                        </Tag>
                                      )}
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
                      {access.canDownload && (
                        <Button size="small" icon={<DownloadOutlined />} onClick={() => onDownloadGroupTender(group)}>
                          招标文件
                        </Button>
                      )}
                      {access.canView && (
                        <Button size="small" icon={<EyeOutlined />} onClick={() => onDetail(record.id)}>
                          详情
                        </Button>
                      )}
                      {access.canEdit && (
                        <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(record.id)}>
                          编辑
                        </Button>
                      )}
                      {access.canDelete && (
                        <Popconfirm title="确定删除该项目？" onConfirm={() => onDelete(record.id)}>
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>
                      )}
                      {canDeleteGroup && (
                        <Popconfirm
                          title="删除该项目组？"
                          description="会删除项目组下的参加单位和文件版本。"
                          onConfirm={() => onDeleteGroup(group)}
                        >
                          <Button size="small" danger icon={<DeleteOutlined />}>
                            删除项目组
                          </Button>
                        </Popconfirm>
                      )}
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
