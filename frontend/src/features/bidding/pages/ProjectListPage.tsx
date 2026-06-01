import { useCallback, useEffect, useMemo, useState, type Key } from "react";
import {
  Button,
  Card,
  FloatButton,
  Input,
  Pagination,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
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
import { useIsMobile } from "@/hooks/useIsMobile";
import { useAuthStore } from "@/store/authStore";
import {
  createGroup,
  createProject,
  deleteBidVersion,
  deleteCompany,
  deleteProject,
  downloadBidVersion,
  downloadBidVersionReport,
  downloadGroupAttachment,
  downloadProjectAttachment,
  fetchCompany,
  fetchProject,
  fetchProjects,
  previewBidVersion,
  submitFeedback,
  updateGroup,
  updateProject,
  updateBidVersionAnalysisStatus,
  updateBidVersionThirdPartySyncStatus,
  uploadBidVersionReport,
} from "../api";
import AnalysisStatusSwitch from "../components/AnalysisStatusSwitch";
import FeedbackModal from "../components/FeedbackModal";
import BidFilePreviewLink from "../components/BidFilePreviewLink";
import EllipsisTooltip from "../components/EllipsisTooltip";
import GroupFormModal from "../components/GroupFormModal";
import ProjectDetailDrawer from "../components/ProjectDetailDrawer";
import ProjectFormModal from "../components/ProjectFormModal";
import ProjectMobileCardList from "../components/ProjectMobileCardList";
import {
  ACCEPTED_FILE_TYPES,
  PROJECT_STATUS_MAP,
  REPORT_STATUS_MAP,
  THIRD_PARTY_SYNC_STATUS_MAP,
} from "../constants";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectDetail,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
  FeedbackFormValues,
  FeedbackTarget,
  GroupFormValues,
  ProjectFormValues,
  ProjectRevisionPreset,
  ProjectStatus,
  ProjectTreeRow,
  ThirdPartySyncStatus,
} from "../types";

function rowKey(record: ProjectTreeRow) {
  return `${record.row_type}-${record.id}`;
}

function getGroupTenderFile(group: BiddingProjectGroupTreeItem) {
  const groupTender = group.attachments.find((file) => file.attachment_type === "tender_doc");
  if (groupTender) {
    return { source: "group" as const, groupId: group.id, attachment: groupTender };
  }

  for (const project of group.children) {
    const projectTender = project.attachments.find((file) => file.attachment_type === "tender_doc");
    if (projectTender) {
      return {
        source: "project" as const,
        projectId: project.id,
        attachment: projectTender,
      };
    }
  }

  return null;
}

function hasVersionReport(record: Pick<BidVersionListItem, "report_original_name" | "report_uploaded_at">) {
  return Boolean(record.report_original_name || record.report_uploaded_at);
}

export default function ProjectListPage() {
  const isMobile = useIsMobile();
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<BiddingProjectGroupTreeItem[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<Key[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<BiddingProjectDetail | null>(null);
  const [activeFeedbackTarget, setActiveFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: number; name: string } | null>(null);
  const [presetGroupId, setPresetGroupId] = useState<number | null>(null);
  const [presetRevision, setPresetRevision] = useState<ProjectRevisionPreset | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
      if (data.items.length > 0) {
        setExpandedRowKeys([rowKey(data.items[0])]);
      } else {
        setExpandedRowKeys([]);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载项目列表失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const treeData = useMemo<ProjectTreeRow[]>(() => items, [items]);

  const openDetail = async (id: number) => {
    try {
      const project = await fetchProject(id);
      setActiveProject(project);
      setDetailOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载详情失败");
    }
  };

  const openCreate = (groupId?: number) => {
    setActiveProject(null);
    setPresetRevision(null);
    setPresetGroupId(groupId ?? null);
    setFormOpen(true);
  };

  const openUploadRevision = (
    groupId: number,
    project: Pick<BiddingProjectListItem, "name" | "bid_opening_at">,
    company: Pick<BiddingCompanyListItem, "name">,
  ) => {
    setActiveProject(null);
    setPresetGroupId(null);
    setPresetRevision({
      groupId,
      projectName: project.name,
      companyName: company.name,
      bidOpeningAt: project.bid_opening_at,
    });
    setFormOpen(true);
  };

  const openEditGroup = (group: BiddingProjectGroupTreeItem) => {
    setEditingGroup({ id: group.id, name: group.name });
    setGroupFormOpen(true);
  };

  const openEdit = async (id: number) => {
    try {
      const project = await fetchProject(id);
      setActiveProject(project);
      setPresetGroupId(null);
      setPresetRevision(null);
      setFormOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载项目失败");
    }
  };

  const openFeedback = async (company: BiddingCompanyListItem, project: BiddingProjectListItem) => {
    if (company.status === "registered") {
      message.warning("开标时间未到，暂不可提交评审反馈");
      return;
    }
    try {
      const detail = await fetchCompany(company.id);
      setActiveFeedbackTarget({
        companyId: company.id,
        companyName: company.name,
        projectName: project.name,
        feedback: detail.feedback,
      });
      setFeedbackOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载投标单位失败");
    }
  };

  const handleFormSubmit = async (values: ProjectFormValues) => {
    setSubmitting(true);
    try {
      if (activeProject) {
        await updateProject(activeProject.id, {
          name: values.name!,
          participating_units: values.participating_units!,
        });
        message.success("项目已更新");
      } else if (
        values.group_mode === "new" &&
        !presetGroupId &&
        !presetRevision &&
        values.group_name &&
        !values.name
      ) {
        await createGroup(values.group_name, values.tender_doc, values.group_bid_opening_at);
        message.success("项目组已创建");
      } else {
        await createProject(values);
        message.success(presetRevision ? "新版投标文件已上传" : "项目已登记");
      }
      setFormOpen(false);
      setActiveProject(null);
      setPresetGroupId(null);
      setPresetRevision(null);
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGroupFormSubmit = async (values: GroupFormValues) => {
    if (!editingGroup) return;
    setSubmitting(true);
    try {
      await updateGroup(editingGroup.id, values);
      message.success("项目组已更新");
      setGroupFormOpen(false);
      setEditingGroup(null);
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (values: FeedbackFormValues) => {
    if (!activeFeedbackTarget) return;
    setSubmitting(true);
    try {
      await submitFeedback(activeFeedbackTarget.companyId, values);
      message.success("评审反馈已保存");
      setFeedbackOpen(false);
      setActiveFeedbackTarget(null);
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      message.success("项目已删除");
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleDeleteBidVersion = async (id: number) => {
    try {
      await deleteBidVersion(id);
      message.success("版本已删除");
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleDownloadVersion = async (record: BidVersionListItem) => {
    try {
      await downloadBidVersion({ attachmentId: record.id, filename: record.original_name });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  const handleDownloadVersionReport = async (record: BidVersionListItem) => {
    if (!record.report_original_name) {
      message.warning("暂无报告可下载");
      return;
    }
    try {
      await downloadBidVersionReport({ attachmentId: record.id, filename: record.report_original_name });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载报告失败");
    }
  };

  const handleDownloadGroupTender = async (group: BiddingProjectGroupTreeItem) => {
    const tenderFile = getGroupTenderFile(group);
    if (!tenderFile) {
      message.warning("暂无招标文件可下载");
      return;
    }

    try {
      if (tenderFile.source === "group") {
        await downloadGroupAttachment({
          groupId: tenderFile.groupId,
          attachmentId: tenderFile.attachment.id,
          filename: tenderFile.attachment.original_name,
        });
      } else {
        await downloadProjectAttachment({
          projectId: tenderFile.projectId,
          attachmentId: tenderFile.attachment.id,
          filename: tenderFile.attachment.original_name,
        });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载招标文件失败");
    }
  };

  const handlePreviewVersion = async (record: BidVersionListItem) => {
    await previewBidVersion({ attachmentId: record.id, filename: record.original_name });
  };

  const patchVersionAnalysisStatus = (attachmentId: number, analysisStatus: boolean) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId ? { ...version, analysis_status: analysisStatus } : version,
            ),
          })),
        })),
      })),
    );
  };

  const patchVersionThirdPartySyncStatus = (
    attachmentId: number,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId
                ? { ...version, third_party_sync_status: thirdPartySyncStatus }
                : version,
            ),
          })),
        })),
      })),
    );
  };

  const patchVersionReport = (
    attachmentId: number,
    report: Pick<BidVersionListItem, "report_original_name" | "report_size_bytes" | "report_uploaded_at">,
  ) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId
                ? {
                    ...version,
                    report_original_name: report.report_original_name,
                    report_size_bytes: report.report_size_bytes,
                    report_uploaded_at: report.report_uploaded_at,
                  }
                : version,
            ),
          })),
        })),
      })),
    );
  };

  const handleAnalysisStatusChange = async (record: BidVersionListItem, analysisStatus: boolean) => {
    const previous = record.analysis_status;
    patchVersionAnalysisStatus(record.id, analysisStatus);
    try {
      await updateBidVersionAnalysisStatus({ attachmentId: record.id, analysisStatus });
      message.success(analysisStatus ? "已标记为已分析" : "已标记为未分析");
    } catch (error) {
      patchVersionAnalysisStatus(record.id, previous);
      message.error(error instanceof Error ? error.message : "更新分析状态失败");
    }
  };

  const handleThirdPartySyncStatusChange = async (
    record: BidVersionListItem,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => {
    const previous = record.third_party_sync_status;
    patchVersionThirdPartySyncStatus(record.id, thirdPartySyncStatus);
    try {
      await updateBidVersionThirdPartySyncStatus({
        attachmentId: record.id,
        thirdPartySyncStatus,
      });
      message.success(thirdPartySyncStatus === "synced" ? "已标记为已同步" : "已标记为未同步");
    } catch (error) {
      patchVersionThirdPartySyncStatus(record.id, previous);
      message.error(error instanceof Error ? error.message : "更新三方对接状态失败");
    }
  };

  const handleUploadVersionReport = async (record: BidVersionListItem, file: File) => {
    try {
      const next = await uploadBidVersionReport({ attachmentId: record.id, file });
      patchVersionReport(record.id, {
        report_original_name: next.report_original_name ?? null,
        report_size_bytes: next.report_size_bytes ?? null,
        report_uploaded_at: next.report_uploaded_at ?? null,
      });
      message.success("报告已上传");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传报告失败");
    }
  };

  const handleDeleteCompany = async (id: number) => {
    try {
      await deleteCompany(id);
      message.success("投标单位已删除");
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const findGroupIdForProject = (projectId: number) => {
    for (const group of items) {
      if (group.children.some((p) => p.id === projectId)) return group.id;
    }
    return null;
  };

  const renderProjectActions = (record: BiddingProjectListItem) => {
    return (
      <Space size={4} wrap>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record.id)}>
          详情
        </Button>
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record.id)}>
          编辑
        </Button>
        <Popconfirm title="确定删除该项目？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  const renderCompanyActions = (record: BiddingCompanyListItem, project: BiddingProjectListItem) => {
    const groupId = findGroupIdForProject(record.project_id);
    return (
      <Space size={4} wrap>
        <Button
          type="link"
          size="small"
          icon={<HistoryOutlined />}
          disabled={!groupId}
          onClick={() => groupId && openUploadRevision(groupId, project, record)}
        >
          上传新版投标文件
        </Button>
        <Button
          type="link"
          size="small"
          icon={<FileSearchOutlined />}
          disabled={record.status === "registered"}
          onClick={() => openFeedback(record, project)}
        >
          {record.status === "completed" ? "改反馈" : "填反馈"}
        </Button>
        <Popconfirm title="确定删除该单位及全部版本？" onConfirm={() => handleDeleteCompany(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  const renderVersionActions = (record: BidVersionListItem) => {
    const nextSyncStatus: ThirdPartySyncStatus =
      record.third_party_sync_status === "synced" ? "unsynced" : "synced";

    return (
      <Space size={4} wrap>
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handlePreviewVersion(record)}>
          预览
        </Button>
        <Button
          type="link"
          size="small"
          icon={<DownloadOutlined />}
          onClick={() => handleDownloadVersion(record)}
        >
          下载投标文件
        </Button>
        {isSuperAdmin && (
          <Button
            type="link"
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleThirdPartySyncStatusChange(record, nextSyncStatus)}
          >
            {nextSyncStatus === "synced" ? "标为已同步" : "标为未同步"}
          </Button>
        )}
        {isSuperAdmin && (
          <Upload
            accept={ACCEPTED_FILE_TYPES}
            showUploadList={false}
            beforeUpload={(file) => {
              void handleUploadVersionReport(record, file);
              return false;
            }}
          >
            <Button type="link" size="small" icon={<UploadOutlined />}>
              上传报告
            </Button>
          </Upload>
        )}
        {hasVersionReport(record) && (
          <Button
            type="link"
            size="small"
            icon={<DownloadOutlined />}
            onClick={() => handleDownloadVersionReport(record)}
          >
            下载报告
          </Button>
        )}
        <Popconfirm title="确定删除该版本？" onConfirm={() => handleDeleteBidVersion(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>
            删除
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  const columns: ColumnsType<ProjectTreeRow> = [
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
      width: 260,
      render: (name: string, record) => {
        if (record.row_type === "group") {
          return (
            <Space align="start" className="min-w-0 max-w-full">
              <FolderOutlined className="text-blue-500 shrink-0" />
              <EllipsisTooltip title={name}>
                <Typography.Text strong>{name}</Typography.Text>
              </EllipsisTooltip>
            </Space>
          );
        }
        if (record.row_type === "company") {
          return (
            <Space align="start" className="pl-12 min-w-0 max-w-full">
              <BankOutlined className="text-emerald-600 shrink-0" />
              <EllipsisTooltip title={name}>{name}</EllipsisTooltip>
            </Space>
          );
        }
        if (record.row_type === "version") {
          return (
            <div className="flex min-w-0 items-center pl-[4.5rem] text-gray-600">
              <span className="shrink-0">v{record.version_number} · </span>
              <BidFilePreviewLink attachmentId={record.id} filename={record.original_name} />
            </div>
          );
        }
        return (
          <div className="pl-6 min-w-0">
            <EllipsisTooltip title={name}>{name}</EllipsisTooltip>
          </div>
        );
      },
    },
    {
      title: "投标单位 / 文件",
      key: "participating_units",
      ellipsis: true,
      render: (_, record) => {
        if (record.row_type === "group") {
          return <EllipsisTooltip title="-">-</EllipsisTooltip>;
        }
        if (record.row_type === "version") {
          const timeText = formatChinaTime(record.created_at, "YYYY-MM-DD HH:mm");
          return <EllipsisTooltip title={timeText}>{timeText}</EllipsisTooltip>;
        }
        if (record.row_type === "company") {
          const text = `${record.version_count} 个版本`;
          return <EllipsisTooltip title={text}>{text}</EllipsisTooltip>;
        }
        if (record.company_count > 0) {
          const text = `${record.company_count} 家：${record.participating_units || "-"}`;
          return <EllipsisTooltip title={text}>{text}</EllipsisTooltip>;
        }
        const text = record.participating_units || "-";
        return <EllipsisTooltip title={text}>{text}</EllipsisTooltip>;
      },
    },
    {
      title: "开标时间",
      dataIndex: "bid_opening_at",
      width: 170,
      render: (value: string | undefined) => {
        const timeText = value ? formatChinaTime(value, "YYYY-MM-DD HH:mm") : "-";
        return <EllipsisTooltip title={timeText}>{timeText}</EllipsisTooltip>;
      },
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_, record) => {
        if (record.row_type === "group") {
          const text = `${record.children.length} 个项目`;
          return (
            <EllipsisTooltip title={text}>
              <Tag color="blue">{text}</Tag>
            </EllipsisTooltip>
          );
        }
        if (record.row_type === "company") {
          const meta = PROJECT_STATUS_MAP[record.status];
          return (
            <EllipsisTooltip title={meta.label}>
              <Tag color={meta.color}>{meta.label}</Tag>
            </EllipsisTooltip>
          );
        }
        if (record.row_type === "version") {
          return (
            <EllipsisTooltip title="投标文件">
              <Tag>投标文件</Tag>
            </EllipsisTooltip>
          );
        }
        const meta = PROJECT_STATUS_MAP[record.status];
        const statusText = record.attachments.length > 0 ? `${meta.label} · 有招标文件` : meta.label;
        return (
          <EllipsisTooltip title={statusText}>
            <Space size={4}>
              <Tag color={meta.color}>{meta.label}</Tag>
              {record.attachments.length > 0 && <Tag color="processing">有招标文件</Tag>}
            </Space>
          </EllipsisTooltip>
        );
      },
    },
    {
      title: "分析状态",
      key: "analysis_status",
      width: 110,
      render: (_, record) => {
        if (record.row_type !== "version") {
          return <EllipsisTooltip title="-">-</EllipsisTooltip>;
        }
        return (
          <AnalysisStatusSwitch
            value={record.analysis_status}
            disabled={!isSuperAdmin}
            onChange={(checked) => handleAnalysisStatusChange(record, checked)}
          />
        );
      },
    },
    {
      title: "三方对接",
      key: "third_party_sync_status",
      width: 110,
      render: (_, record) => {
        if (record.row_type !== "version") {
          return <EllipsisTooltip title="-">-</EllipsisTooltip>;
        }
        const meta = THIRD_PARTY_SYNC_STATUS_MAP[record.third_party_sync_status ?? "unsynced"];
        return (
          <EllipsisTooltip title={meta.label}>
            <Tag color={meta.color}>{meta.label}</Tag>
          </EllipsisTooltip>
        );
      },
    },
    {
      title: "报告状态",
      key: "report_status",
      width: 110,
      render: (_, record) => {
        if (record.row_type !== "version") {
          return <EllipsisTooltip title="-">-</EllipsisTooltip>;
        }
        const meta = REPORT_STATUS_MAP[hasVersionReport(record) ? "uploaded" : "pending"];
        return (
          <EllipsisTooltip title={meta.label}>
            <Tag color={meta.color}>{meta.label}</Tag>
          </EllipsisTooltip>
        );
      },
    },
    {
      title: "最终得分",
      key: "final_score",
      width: 100,
      render: (_, record) => {
        if (record.row_type === "company" && record.final_score != null) {
          const text = record.final_score.toFixed(2);
          return <EllipsisTooltip title={text}>{text}</EllipsisTooltip>;
        }
        return <EllipsisTooltip title="-">-</EllipsisTooltip>;
      },
    },
    {
      title: "排名",
      key: "ranking",
      width: 72,
      render: (_, record) => {
        const text = record.row_type === "company" ? String(record.ranking ?? "-") : "-";
        return <EllipsisTooltip title={text}>{text}</EllipsisTooltip>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 170,
      render: (value: string | undefined) => {
        const timeText = value ? formatChinaTime(value, "YYYY-MM-DD HH:mm") : "-";
        return <EllipsisTooltip title={timeText}>{timeText}</EllipsisTooltip>;
      },
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 500,
      render: (_, record) => {
        if (record.row_type === "group") {
          const tenderFile = getGroupTenderFile(record);
          return (
            <Space size={4} wrap>
              <Button
                type="link"
                size="small"
                icon={<DownloadOutlined />}
                disabled={!tenderFile}
                onClick={() => handleDownloadGroupTender(record)}
              >
                下载招标文件
              </Button>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditGroup(record)}>
                编辑组
              </Button>
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreate(record.id)}>
                添加项目
              </Button>
            </Space>
          );
        }
        if (record.row_type === "company") {
          const project = items.flatMap((g) => g.children).find((p) => p.id === record.project_id);
          if (!project) return null;
          return renderCompanyActions(record, project);
        }
        if (record.row_type === "version") {
          return renderVersionActions(record);
        }
        return renderProjectActions(record);
      },
    },
  ];

  const filterBar = (
    <div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
      <Input.Search
        allowClear
        placeholder="搜索项目组、项目或投标单位"
        className="w-full sm:!w-80"
        onSearch={(value) => {
          setKeyword(value.trim());
          setPage(1);
        }}
      />
      <Select
        allowClear
        placeholder="项目状态"
        className="w-full sm:!w-36"
        value={statusFilter || undefined}
        onChange={(value) => {
          setStatusFilter((value as ProjectStatus) || "");
          setPage(1);
        }}
        options={Object.entries(PROJECT_STATUS_MAP).map(([value, meta]) => ({
          value,
          label: meta.label,
        }))}
      />
      <Button onClick={loadList} className="w-full sm:w-auto">
        刷新
      </Button>
    </div>
  );

  const paginationNode = (
    <div className="mt-4 flex justify-center md:justify-end">
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        size={isMobile ? "small" : "middle"}
        showSizeChanger={!isMobile}
        showTotal={isMobile ? undefined : (t) => `共 ${t} 个项目组`}
        onChange={(nextPage, nextSize) => {
          setPage(nextPage);
          setPageSize(nextSize ?? pageSize);
        }}
        simple={isMobile}
      />
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Typography.Title level={isMobile ? 5 : 4} className="!mb-1">
            招投标项目管理
          </Typography.Title>
          {!isMobile && (
            <Typography.Paragraph type="secondary" className="!mb-0">
              登记项目时填写参加单位并上传文件；同名参加单位自动分组，重复上传记为新版本
            </Typography.Paragraph>
          )}
        </div>
        {!isMobile && (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
            新建项目组
          </Button>
        )}
      </div>

      <Card bodyStyle={isMobile ? { padding: 12 } : undefined}>
        {filterBar}

        {isMobile ? (
          <>
            <ProjectMobileCardList
              loading={loading}
              groups={items}
              onDetail={openDetail}
              onEdit={openEdit}
              onFeedback={openFeedback}
              onDelete={handleDelete}
              onEditGroup={openEditGroup}
              onDownloadGroupTender={handleDownloadGroupTender}
              onAddProject={openCreate}
              onUploadRevision={(groupId, project, company) => openUploadRevision(groupId, project, company)}
              onDeleteCompany={handleDeleteCompany}
              onPreviewVersion={handlePreviewVersion}
              onDownloadVersion={handleDownloadVersion}
              onDownloadVersionReport={handleDownloadVersionReport}
              onUploadVersionReport={handleUploadVersionReport}
              onAnalysisStatusChange={handleAnalysisStatusChange}
              onThirdPartySyncStatusChange={handleThirdPartySyncStatusChange}
              isSuperAdmin={isSuperAdmin}
              onDeleteVersion={handleDeleteBidVersion}
            />
            {paginationNode}
          </>
        ) : (
          <Table
            rowKey={rowKey}
            loading={loading}
            columns={columns}
            dataSource={treeData}
            childrenColumnName="children"
            expandable={{
              expandedRowKeys,
              onExpandedRowsChange: (keys) => setExpandedRowKeys([...keys]),
            }}
            scroll={{ x: 1540 }}
            pagination={{
              current: page,
              pageSize,
              total,
              showSizeChanger: true,
              showTotal: (t) => `共 ${t} 个项目组`,
              onChange: (nextPage, nextSize) => {
                setPage(nextPage);
                setPageSize(nextSize);
              },
            }}
          />
        )}
      </Card>

      {isMobile && (
        <FloatButton
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCreate()}
          tooltip="新建项目组"
        />
      )}

      <ProjectFormModal
        open={formOpen}
        loading={submitting}
        project={activeProject}
        presetGroupId={presetGroupId}
        presetRevision={presetRevision}
        onCancel={() => {
          setFormOpen(false);
          setActiveProject(null);
          setPresetGroupId(null);
          setPresetRevision(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <GroupFormModal
        open={groupFormOpen}
        loading={submitting}
        groupId={editingGroup?.id}
        groupName={editingGroup?.name}
        onCancel={() => {
          setGroupFormOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleGroupFormSubmit}
      />

      <FeedbackModal
        open={feedbackOpen}
        loading={submitting}
        target={activeFeedbackTarget}
        onCancel={() => {
          setFeedbackOpen(false);
          setActiveFeedbackTarget(null);
        }}
        onSubmit={handleFeedbackSubmit}
      />

      <ProjectDetailDrawer
        open={detailOpen}
        project={activeProject}
        onClose={() => {
          setDetailOpen(false);
          setActiveProject(null);
        }}
      />
    </div>
  );
}
