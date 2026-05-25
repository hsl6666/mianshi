import { useCallback, useEffect, useMemo, useState } from "react";
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
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileSearchOutlined,
  FolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  createGroup,
  createProject,
  deleteProject,
  fetchProject,
  fetchProjects,
  submitFeedback,
  updateGroup,
  updateProject,
} from "../api";
import FeedbackModal from "../components/FeedbackModal";
import GroupFormModal from "../components/GroupFormModal";
import ProjectDetailDrawer from "../components/ProjectDetailDrawer";
import ProjectFormModal from "../components/ProjectFormModal";
import ProjectMobileCardList from "../components/ProjectMobileCardList";
import { PROJECT_STATUS_MAP } from "../constants";
import type {
  BiddingProjectDetail,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
  FeedbackFormValues,
  GroupFormValues,
  ProjectFormValues,
  ProjectStatus,
  ProjectTreeRow,
} from "../types";

function rowKey(record: ProjectTreeRow) {
  return `${record.row_type}-${record.id}`;
}

export default function ProjectListPage() {
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<BiddingProjectGroupTreeItem[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<BiddingProjectDetail | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: number; name: string } | null>(null);
  const [presetGroupId, setPresetGroupId] = useState<number | null>(null);

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
    setPresetGroupId(groupId ?? null);
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
      setFormOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载项目失败");
    }
  };

  const openFeedback = async (id: number) => {
    try {
      const project = await fetchProject(id);
      if (project.status === "registered") {
        message.warning("开标时间未到，暂不可提交评审反馈");
        return;
      }
      setActiveProject(project);
      setFeedbackOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载项目失败");
    }
  };

  const handleFormSubmit = async (values: ProjectFormValues) => {
    setSubmitting(true);
    try {
      if (activeProject) {
        await updateProject(activeProject.id, {
          name: values.name!,
          participating_units: values.participating_units!,
          bid_opening_at: values.bid_opening_at!,
        });
        message.success("项目已更新");
      } else if (values.group_mode === "new" && values.group_name && !values.name) {
        await createGroup(values.group_name);
        message.success("项目组已创建");
      } else {
        await createProject(values);
        message.success("项目已创建");
      }
      setFormOpen(false);
      setActiveProject(null);
      setPresetGroupId(null);
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
      message.success("项目组名称已更新");
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
    if (!activeProject) return;
    setSubmitting(true);
    try {
      await submitFeedback(activeProject.id, values);
      message.success("评审反馈已保存");
      setFeedbackOpen(false);
      setActiveProject(null);
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

  const renderProjectActions = (record: BiddingProjectListItem) => (
    <Space size={4} wrap>
      <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record.id)}>
        详情
      </Button>
      <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record.id)}>
        编辑
      </Button>
      <Button
        type="link"
        size="small"
        icon={<FileSearchOutlined />}
        disabled={record.status === "registered"}
        onClick={() => openFeedback(record.id)}
      >
        {record.status === "completed" ? "改反馈" : "填反馈"}
      </Button>
      <Popconfirm title="确定删除该项目？" onConfirm={() => handleDelete(record.id)}>
        <Button type="link" size="small" danger icon={<DeleteOutlined />}>
          删除
        </Button>
      </Popconfirm>
    </Space>
  );

  const columns: ColumnsType<ProjectTreeRow> = [
    {
      title: "名称",
      dataIndex: "name",
      ellipsis: true,
      width: 260,
      render: (name: string, record) => {
        if (record.row_type === "group") {
          return (
            <Space>
              <FolderOutlined className="text-blue-500" />
              <Typography.Text strong>{name}</Typography.Text>
            </Space>
          );
        }
        return <span className="pl-6">{name}</span>;
      },
    },
    {
      title: "参加单位",
      key: "participating_units",
      ellipsis: true,
      render: (_, record) => (record.row_type === "project" ? record.participating_units : "-"),
    },
    {
      title: "开标时间",
      dataIndex: "bid_opening_at",
      width: 170,
      render: (value: string) => dayjs(value).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_, record) => {
        if (record.row_type === "group") {
          return <Tag color="blue">{record.children.length} 个项目</Tag>;
        }
        const meta = PROJECT_STATUS_MAP[record.status];
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: "最终得分",
      key: "final_score",
      width: 100,
      render: (_, record) =>
        record.row_type === "project" && record.final_score != null
          ? record.final_score.toFixed(2)
          : "-",
    },
    {
      title: "排名",
      key: "ranking",
      width: 72,
      render: (_, record) => (record.row_type === "project" ? (record.ranking ?? "-") : "-"),
    },
    {
      title: "附件",
      key: "attachments",
      width: 80,
      render: (_, record) =>
        record.row_type === "group" ? `${record.attachment_count} 个` : "-",
    },
    {
      title: "操作",
      key: "actions",
      fixed: "right",
      width: 300,
      render: (_, record) => {
        if (record.row_type === "group") {
          return (
            <Space size={4} wrap>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditGroup(record)}>
                编辑组
              </Button>
              <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openCreate(record.id)}>
                添加项目
              </Button>
            </Space>
          );
        }
        return renderProjectActions(record);
      },
    },
  ];

  const filterBar = (
    <div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
      <Input.Search
        allowClear
        placeholder="搜索项目组、项目名称或参加单位"
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
              按开标时间创建项目组，文件保存在组内；组下可登记多个子项目并分别录入评审反馈
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
              onAddProject={openCreate}
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
            defaultExpandAllRows
            scroll={{ x: 1100 }}
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
        <FloatButton type="primary" icon={<PlusOutlined />} onClick={() => openCreate()} tooltip="新建项目组" />
      )}

      <ProjectFormModal
        open={formOpen}
        loading={submitting}
        project={activeProject}
        presetGroupId={presetGroupId}
        onCancel={() => {
          setFormOpen(false);
          setActiveProject(null);
          setPresetGroupId(null);
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
        project={activeProject}
        onCancel={() => {
          setFeedbackOpen(false);
          setActiveProject(null);
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
