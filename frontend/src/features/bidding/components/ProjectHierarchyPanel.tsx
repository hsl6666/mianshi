import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Dropdown,
  Empty,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  Upload,
} from "antd";
import type { MenuProps } from "antd";
import {
  BankOutlined,
  CalendarOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FolderOutlined,
  HistoryOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { formatChinaTime } from "@/utils/date";
import AnalysisStatusSwitch from "./AnalysisStatusSwitch";
import BidFilePreviewLink from "./BidFilePreviewLink";
import EllipsisTooltip from "./EllipsisTooltip";
import {
  ACCEPTED_FILE_TYPES,
  countVersionReportStats,
  formatVersionReportScore,
  resolveCompanyProjectAmount,
  PROJECT_STATUS_MAP,
  REPORT_STATUS_MAP,
  resolveReportStatus,
  THIRD_PARTY_SYNC_STATUS_MAP,
  type VersionReportStats,
} from "../constants";
import {
  buildDateTree,
  countDateNodeVersionStats,
  countProjectItemVersionStats,
  type HierarchyProjectItem,
} from "../utils/buildDateTree";
import { buildTechnicalReport2Url } from "../utils/technicalReport2Url";
import type { BiddingAccess } from "@/constants/permissions";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
  ThirdPartySyncStatus,
} from "../types";

interface ProjectHierarchyPanelProps {
  loading: boolean;
  groups: BiddingProjectGroupTreeItem[];
  access: BiddingAccess;
  isSuperAdmin: boolean;
  canDeleteGroup: boolean;
  onEditGroup: (group: BiddingProjectGroupTreeItem) => void;
  onDeleteGroup: (group: BiddingProjectGroupTreeItem) => void;
  onDownloadGroupTender: (group: BiddingProjectGroupTreeItem) => void;
  onAddProject: (groupId: number) => void;
  onEditProject: (projectId: number) => void;
  onDeleteProject: (projectId: number) => void;
  onProjectDetail: (projectId: number) => void;
  onUploadRevision: (
    groupId: number,
    project: Pick<BiddingProjectListItem, "name" | "bid_opening_time">,
    company: Pick<BiddingCompanyListItem, "name">,
  ) => void;
  onFeedback: (company: BiddingCompanyListItem, project: BiddingProjectListItem) => void;
  onDeleteCompany: (companyId: number) => void;
  onPreviewVersion: (record: BidVersionListItem) => void;
  onDownloadVersion: (record: BidVersionListItem) => void;
  onDownloadVersionReport: (record: BidVersionListItem) => void;
  onUploadVersionReport: (record: BidVersionListItem, file: File) => void;
  onAnalysisStatusChange: (record: BidVersionListItem, analysisStatus: boolean) => void;
  onThirdPartySyncStatusChange: (
    record: BidVersionListItem,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => void;
  onDeleteVersion: (versionId: number) => void;
  onJsonUpload: (record: BidVersionListItem) => void;
  onAnalyzeVersion: (record: BidVersionListItem) => void;
  analyzingVersionIds: Set<number>;
  onRefresh: () => void;
}

interface SelectedCompany {
  company: BiddingCompanyListItem;
  project: BiddingProjectListItem;
  groupId: number;
}

function hasVersionReport(record: Pick<BidVersionListItem, "report_has_data">) {
  return Boolean(record.report_has_data);
}

function projectDisplayName(item: HierarchyProjectItem) {
  return item.isPlaceholder ? item.projectName : item.project!.name;
}

function NavVersionStats({ stats, compact = false }: { stats: VersionReportStats; compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${compact ? "text-xs" : "text-sm"}`}>
      {!compact && <span className="text-gray-400">总数/未解析</span>}
      <span className="font-semibold text-blue-600">{stats.total}</span>
      <span className="text-gray-300">/</span>
      <span className="font-semibold text-red-500">{stats.incomplete}</span>
    </span>
  );
}

export default function ProjectHierarchyPanel({
  loading,
  groups,
  access,
  isSuperAdmin,
  canDeleteGroup,
  onEditGroup,
  onDeleteGroup,
  onDownloadGroupTender,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onProjectDetail,
  onUploadRevision,
  onFeedback,
  onDeleteCompany,
  onPreviewVersion,
  onDownloadVersion,
  onDownloadVersionReport,
  onUploadVersionReport,
  onAnalysisStatusChange,
  onThirdPartySyncStatusChange,
  onDeleteVersion,
  onJsonUpload,
  onAnalyzeVersion,
  analyzingVersionIds,
  onRefresh,
}: ProjectHierarchyPanelProps) {
  const navigate = useNavigate();
  const dateTree = useMemo(() => buildDateTree(groups), [groups]);
  const [expandedDates, setExpandedDates] = useState<string[]>([]);
  const [expandedProjects, setExpandedProjects] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<SelectedCompany | null>(null);

  const groupMap = useMemo(() => new Map(groups.map((group) => [group.db_id, group])), [groups]);
  const globalVersionStats = useMemo(() => {
    const versions = groups.flatMap((group) =>
      group.children.flatMap((project) => project.children.flatMap((company) => company.children)),
    );
    return countVersionReportStats(versions);
  }, [groups]);

  const selectedProjectAmount = useMemo(
    () => (selectedCompany ? resolveCompanyProjectAmount(selectedCompany.company.children) : ""),
    [selectedCompany],
  );

  useEffect(() => {
    if (dateTree.length === 0) {
      setExpandedDates([]);
      setExpandedProjects([]);
      setSelectedCompany(null);
      return;
    }

    setSelectedCompany((current) => {
      if (current) {
        const group = groups.find((item) => item.db_id === current.groupId);
        const project = group?.children.find((item) => item.id === current.project.id);
        const company = project?.children.find((item) => item.id === current.company.id);
        if (group && project && company) {
          return { company, project, groupId: group.db_id };
        }
      }

      const firstDate = dateTree[0];
      const firstProject = firstDate.projects[0];
      setExpandedDates([firstDate.dateKey]);
      if (firstProject) {
        setExpandedProjects([firstProject.key]);
        const firstCompany = firstProject.companies[0];
        if (firstCompany && firstProject.project) {
          return {
            company: firstCompany,
            project: firstProject.project,
            groupId: firstProject.dbId,
          };
        }
      }
      return null;
    });
  }, [dateTree, groups]);

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) =>
      prev.includes(dateKey) ? prev.filter((key) => key !== dateKey) : [...prev, dateKey],
    );
  };

  const toggleProject = (projectKey: string) => {
    setExpandedProjects((prev) =>
      prev.includes(projectKey) ? prev.filter((key) => key !== projectKey) : [...prev, projectKey],
    );
  };

  const selectCompany = (
    company: BiddingCompanyListItem,
    project: BiddingProjectListItem,
    groupId: number,
  ) => {
    setSelectedCompany({ company, project, groupId });
  };

  const renderProjectMenu = (item: HierarchyProjectItem): MenuProps["items"] => {
    const group = groupMap.get(item.dbId);
    if (!group) return [];

    const items: MenuProps["items"] = [];

    if (access.canDownload) {
      items.push({
        key: "tender",
        icon: <DownloadOutlined />,
        label: "下载招标文件",
        onClick: () => onDownloadGroupTender(group),
      });
    }
    if (access.canEdit) {
      items.push({
        key: "edit-group",
        icon: <EditOutlined />,
        label: "编辑项目",
        onClick: () => onEditGroup(group),
      });
    }
    if (access.canCreate) {
      items.push({
        key: "add",
        icon: <PlusOutlined />,
        label: "添加项目",
        onClick: () => onAddProject(item.dbId),
      });
    }
    if (canDeleteGroup) {
      items.push({
        key: "delete-group",
        icon: <DeleteOutlined />,
        danger: true,
        label: "删除项目组",
        onClick: () => onDeleteGroup(group),
      });
    }

    if (!item.isPlaceholder && item.project) {
      if (items.length > 0) {
        items.push({ type: "divider" });
      }
      if (access.canView) {
        items.push({
          key: "detail",
          icon: <EyeOutlined />,
          label: "项目详情",
          onClick: () => onProjectDetail(item.project!.id),
        });
      }
      if (access.canEdit) {
        items.push({
          key: "edit-project",
          icon: <EditOutlined />,
          label: "编辑参加单位信息",
          onClick: () => onEditProject(item.project!.id),
        });
      }
      if (access.canDelete) {
        items.push({
          key: "delete",
          icon: <DeleteOutlined />,
          danger: true,
          label: "删除项目",
          onClick: () => onDeleteProject(item.project!.id),
        });
      }
    }

    return items;
  };

  const versionColumns = [
    {
      title: "版本",
      dataIndex: "version_number",
      width: 72,
      render: (value: number) => `V${value}`,
    },
    {
      title: "投标文件",
      key: "file",
      render: (_: unknown, record: BidVersionListItem) =>
        access.canPreview ? (
          <BidFilePreviewLink attachmentId={record.id} filename={record.original_name} />
        ) : (
          <EllipsisTooltip title={record.original_name}>
            <span>{record.original_name}</span>
          </EllipsisTooltip>
        ),
    },
    ...(isSuperAdmin
      ? [
          {
            title: "分数",
            key: "report_final_score",
            width: 88,
            render: (_: unknown, record: BidVersionListItem) => {
              const scoreText = formatVersionReportScore(record);
              return scoreText === "-" ? (
                <span className="text-gray-400">-</span>
              ) : (
                <span className="font-medium text-orange-600">{scoreText}</span>
              );
            },
          },
        ]
      : []),
    {
      title: "上传时间",
      dataIndex: "created_at",
      width: 160,
      render: (value: string) => formatChinaTime(value, "YYYY-MM-DD HH:mm"),
    },
    {
      title: "分析状态",
      key: "analysis_status",
      width: 100,
      render: (_: unknown, record: BidVersionListItem) => (
        <AnalysisStatusSwitch
          value={record.analysis_status}
          disabled={!access.canAnalysis}
          onChange={(checked) => onAnalysisStatusChange(record, checked)}
        />
      ),
    },
    ...(access.canSync
      ? [
          {
            title: "三方同步",
            key: "third_party_sync_status",
            width: 100,
            render: (_: unknown, record: BidVersionListItem) => {
              const meta = THIRD_PARTY_SYNC_STATUS_MAP[record.third_party_sync_status ?? "unsynced"];
              return <Tag color={meta.color}>{meta.label}</Tag>;
            },
          },
        ]
      : []),
    {
      title: "报告状态",
      key: "report_status",
      width: 110,
      render: (_: unknown, record: BidVersionListItem) => {
        const meta = REPORT_STATUS_MAP[resolveReportStatus(record)];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "反馈建议",
      dataIndex: "report_feedback",
      width: 220,
      render: (value: string | null) =>
        value ? <EllipsisTooltip title={value} /> : <span className="text-gray-400">-</span>,
    },
    {
      title: "操作",
      key: "actions",
      width: 400,
      render: (_: unknown, record: BidVersionListItem) => {
        const nextSyncStatus: ThirdPartySyncStatus =
          record.third_party_sync_status === "synced" ? "unsynced" : "synced";
        return (
          <Space size={4} wrap>
            {access.canPreview && (
              <Button type="link" size="small" onClick={() => onPreviewVersion(record)}>
                预览
              </Button>
            )}
            {access.canDownload && (
              <Button type="link" size="small" onClick={() => onDownloadVersion(record)}>
                下载
              </Button>
            )}
            {access.canSync && (
              <Button
                type="link"
                size="small"
                onClick={() => onThirdPartySyncStatusChange(record, nextSyncStatus)}
              >
                {nextSyncStatus === "synced" ? "标为已同步" : "标为未同步"}
              </Button>
            )}
            {access.canCreate && (
              <Button
                type="link"
                size="small"
                loading={analyzingVersionIds.has(record.id)}
                disabled={record.report_status === "analyzing"}
                onClick={() => {
                  onAnalyzeVersion(record);
                }}
              >
                分析
              </Button>
            )}
            {!hasVersionReport(record) && access.canReportUpload && (
              <Upload
                accept={ACCEPTED_FILE_TYPES}
                showUploadList={false}
                beforeUpload={(file) => {
                  onUploadVersionReport(record, file);
                  return false;
                }}
              >
                <Button type="link" size="small">
                  上传报告
                </Button>
              </Upload>
            )}
            {record.report_original_name && access.canReportDownload && (
              <Button type="link" size="small" onClick={() => onDownloadVersionReport(record)}>
                下载报告
              </Button>
            )}
            {access.canReportJson && (
              <Button type="link" size="small" onClick={() => onJsonUpload(record)}>
                上传JSON
              </Button>
            )}
            {hasVersionReport(record) && access.canReportPage && (
              <Button
                type="link"
                size="small"
                className="!text-emerald-600"
                onClick={() => {
                  if (!selectedCompany) return;
                  const group = groupMap.get(selectedCompany.groupId);
                  navigate(
                    buildTechnicalReport2Url({
                      versionId: record.id,
                      projectName: group?.project_name ?? selectedCompany.project.name,
                      companyName: selectedCompany.company.name,
                    }),
                  );
                }}
              >
                查看报告
              </Button>
            )}
            {access.canDelete && (
              <Popconfirm title="确定删除该版本？" onConfirm={() => onDeleteVersion(record.id)}>
                <Button type="link" size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  if (loading && groups.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Spin />
      </div>
    );
  }

  if (!loading && dateTree.length === 0) {
    return <Empty description="暂无项目数据" className="py-16" />;
  }

  return (
    <Spin spinning={loading}>
      <div className="flex min-h-[560px] gap-4">
      <div className="w-[320px] shrink-0 rounded-lg border border-gray-200 bg-gray-50/60">
        <div className="flex items-center justify-between gap-2 border-b border-gray-200 px-3 py-2">
          <span className="text-sm font-medium text-gray-600">项目导航</span>
          <NavVersionStats stats={globalVersionStats} />
        </div>
        <div className="max-h-[640px] overflow-y-auto p-2">
          {dateTree.map((dateNode) => {
            const dateExpanded = expandedDates.includes(dateNode.dateKey);
            const dateVersionStats = countDateNodeVersionStats(dateNode);
            return (
              <div key={dateNode.dateKey} className="mb-1">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-white"
                  onClick={() => toggleDate(dateNode.dateKey)}
                >
                  <CalendarOutlined className="text-blue-500" />
                  <span className="flex-1 font-medium">{dateNode.dateKey}</span>
                  <NavVersionStats stats={dateVersionStats} compact />
                </button>

                {dateExpanded &&
                  dateNode.projects.map((projectItem) => {
                    const projectExpanded = expandedProjects.includes(projectItem.key);
                    const projectVersionStats = countProjectItemVersionStats(projectItem);
                    const statusMeta = projectItem.project
                      ? PROJECT_STATUS_MAP[projectItem.project.status]
                      : null;

                    return (
                      <div key={projectItem.key} className="ml-3 border-l border-gray-200 pl-2">
                        <div className="group flex items-center gap-1 rounded-md px-2 py-1.5 hover:bg-white">
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            onClick={() => toggleProject(projectItem.key)}
                          >
                            <FolderOutlined className="shrink-0 text-amber-500" />
                            <EllipsisTooltip title={projectDisplayName(projectItem)}>
                              <span className="text-sm font-medium">{projectDisplayName(projectItem)}</span>
                            </EllipsisTooltip>
                            {statusMeta && (
                              <Tag color={statusMeta.color} className="m-0 shrink-0">
                                {statusMeta.label}
                              </Tag>
                            )}
                          </button>
                          <NavVersionStats stats={projectVersionStats} compact />
                          <Dropdown menu={{ items: renderProjectMenu(projectItem) }} trigger={["click"]}>
                            <Button
                              type="text"
                              size="small"
                              icon={<MoreOutlined />}
                              className="opacity-0 group-hover:opacity-100"
                            />
                          </Dropdown>
                        </div>

                        {projectExpanded &&
                          projectItem.companies.map((company) => {
                            const isActive = selectedCompany?.company.id === company.id;
                            const incompleteCount = countVersionReportStats(company.children).incomplete;
                            return (
                              <button
                                key={company.id}
                                type="button"
                                className={`mb-0.5 ml-4 flex w-[calc(100%-1rem)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                                  isActive ? "bg-blue-50 text-blue-700" : "hover:bg-white"
                                }`}
                                onClick={() => {
                                  if (!projectItem.project) return;
                                  selectCompany(company, projectItem.project, projectItem.dbId);
                                }}
                                disabled={!projectItem.project}
                              >
                                <BankOutlined className="shrink-0 text-emerald-600" />
                                <EllipsisTooltip title={company.name}>
                                  <span className="flex-1">{company.name}</span>
                                </EllipsisTooltip>
                                {incompleteCount > 0 && (
                                  <Badge count={incompleteCount} color="red" />
                                )}
                              </button>
                            );
                          })}

                        {projectExpanded && projectItem.companies.length === 0 && (
                          <div className="ml-6 py-1 text-xs text-gray-400">暂无参加单位</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
      </div>

      <Card className="min-w-0 flex-1" bodyStyle={{ padding: 16 }}>
        {!selectedCompany ? (
          <Empty description="请选择左侧参加单位查看投标文件版本" className="py-20" />
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <Typography.Title level={5} className="!mb-1">
                  {selectedCompany.project.name}
                  {selectedProjectAmount ? (
                    <>
                      <span className="mx-2 font-normal text-slate-300">|</span>
                      <span className="font-semibold text-[#0d7a6f]">{selectedProjectAmount}</span>
                    </>
                  ) : null}
                </Typography.Title>
                <Typography.Text type="secondary">
                  {selectedCompany.company.name} · {selectedCompany.company.version_count} 个投标文件版本
                </Typography.Text>
              </div>
              <Space wrap>
                <Button icon={<ReloadOutlined />} loading={loading} onClick={onRefresh}>
                  刷新
                </Button>
                {access.canCreate && (
                  <Button
                    icon={<HistoryOutlined />}
                    onClick={() =>
                      onUploadRevision(selectedCompany.groupId, selectedCompany.project, selectedCompany.company)
                    }
                  >
                    上传新版
                  </Button>
                )}
                {access.canFeedback && (
                  <Button
                    icon={<FileSearchOutlined />}
                    disabled={selectedCompany.company.status === "registered"}
                    onClick={() => onFeedback(selectedCompany.company, selectedCompany.project)}
                  >
                    {selectedCompany.company.status === "completed" ? "改反馈" : "填反馈"}
                  </Button>
                )}
                {access.canDelete && (
                  <Popconfirm
                    title="确定删除该单位及全部版本？"
                    onConfirm={() => onDeleteCompany(selectedCompany.company.id)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      删除单位
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            </div>

            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={versionColumns}
              dataSource={selectedCompany.company.children}
              locale={{ emptyText: "暂无投标文件版本" }}
              scroll={{ x: isSuperAdmin ? 1448 : 1360 }}
            />
          </div>
        )}
      </Card>
      </div>
    </Spin>
  );
}
