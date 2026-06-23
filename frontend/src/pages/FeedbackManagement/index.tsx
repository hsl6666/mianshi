import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import { PlusOutlined, SearchOutlined } from "@ant-design/icons";
import {
  createReportFeedbackTag,
  deleteReportFeedbackEntry,
  deleteReportFeedbackTag,
  fetchReportFeedbackEntries,
  fetchReportFeedbackTags,
  type ReportFeedbackEntryItem,
  type ReportFeedbackTagItem,
  updateReportFeedbackTag,
} from "@/api/reportFeedback";
import { usePermission } from "@/hooks/usePermission";
import { formatChinaTime } from "@/utils/date";

function isPresent<T>(value: T | null | undefined): value is T {
  return value != null;
}

const FEEDBACK_TYPE_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "like", label: "好评" },
  { value: "dislike", label: "差评" },
  { value: "report_suggestion", label: "报告建议" },
];

const TAG_TYPE_OPTIONS = [
  { value: "like", label: "好评标签" },
  { value: "dislike", label: "差评标签" },
];

function feedbackTypeLabel(type: string) {
  if (type === "like") return "好评";
  if (type === "dislike") return "差评";
  if (type === "report_suggestion") return "报告建议";
  return type;
}

export default function FeedbackManagementPage() {
  const { can } = usePermission();
  const canManageTags = can("report_feedback", "manage_tags");
  const canDeleteEntries = can("report_feedback", "delete");

  const [entryForm] = Form.useForm();
  const [tagForm] = Form.useForm();
  const [tags, setTags] = useState<ReportFeedbackTagItem[]>([]);
  const [entries, setEntries] = useState<ReportFeedbackEntryItem[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entryTotal, setEntryTotal] = useState(0);
  const [entryPage, setEntryPage] = useState(1);
  const [entryPageSize, setEntryPageSize] = useState(20);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<ReportFeedbackTagItem | null>(null);
  const [tagSubmitting, setTagSubmitting] = useState(false);

  const loadTags = useCallback(async () => {
    if (!canManageTags) return;
    setTagsLoading(true);
    try {
      setTags(await fetchReportFeedbackTags());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载标签失败");
    } finally {
      setTagsLoading(false);
    }
  }, [canManageTags]);

  const loadEntries = useCallback(async () => {
    setEntriesLoading(true);
    try {
      const values = entryForm.getFieldsValue();
      const data = await fetchReportFeedbackEntries({
        page: entryPage,
        page_size: entryPageSize,
        keyword: values.keyword?.trim() || undefined,
        feedback_type: values.feedback_type || undefined,
      });
      setEntries(data.items);
      setEntryTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载反馈记录失败");
    } finally {
      setEntriesLoading(false);
    }
  }, [entryForm, entryPage, entryPageSize]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const openCreateTag = () => {
    setEditingTag(null);
    tagForm.setFieldsValue({
      feedback_type: "like",
      label: "",
      sort_order: tags.length,
      is_active: true,
    });
    setTagModalOpen(true);
  };

  const openEditTag = (tag: ReportFeedbackTagItem) => {
    setEditingTag(tag);
    tagForm.setFieldsValue({
      feedback_type: tag.feedback_type,
      label: tag.label,
      sort_order: tag.sort_order,
      is_active: tag.is_active,
    });
    setTagModalOpen(true);
  };

  const handleTagSubmit = async () => {
    const values = await tagForm.validateFields();
    setTagSubmitting(true);
    try {
      if (editingTag) {
        await updateReportFeedbackTag(editingTag.id, values);
        message.success("标签已更新");
      } else {
        await createReportFeedbackTag(values);
        message.success("标签已创建");
      }
      setTagModalOpen(false);
      setEditingTag(null);
      tagForm.resetFields();
      await loadTags();
    } catch (error) {
      if (error instanceof Error) message.error(error.message);
    } finally {
      setTagSubmitting(false);
    }
  };

  const handleDeleteTag = async (tagId: number) => {
    try {
      await deleteReportFeedbackTag(tagId);
      message.success("标签已删除");
      await loadTags();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除标签失败");
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    try {
      await deleteReportFeedbackEntry(entryId);
      message.success("反馈记录已删除");
      await loadEntries();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除反馈失败");
    }
  };

  const tagColumns: ColumnsType<ReportFeedbackTagItem> = useMemo(
    () => [
      {
        title: "类型",
        dataIndex: "feedback_type",
        width: 100,
        render: (value: ReportFeedbackTagItem["feedback_type"]) =>
          value === "like" ? <Tag color="success">好评</Tag> : <Tag color="warning">差评</Tag>,
      },
      { title: "标签", dataIndex: "label" },
      { title: "排序", dataIndex: "sort_order", width: 80 },
      {
        title: "启用",
        dataIndex: "is_active",
        width: 80,
        render: (value: boolean) => (value ? "是" : "否"),
      },
      {
        title: "操作",
        key: "actions",
        width: 140,
        render: (_, record) => (
          <Space size={0}>
            <Button type="link" size="small" onClick={() => openEditTag(record)}>
              编辑
            </Button>
            <Popconfirm title="确定删除该标签？" onConfirm={() => handleDeleteTag(record.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [tags.length],
  );

  const entryColumns: ColumnsType<ReportFeedbackEntryItem> = useMemo(
    () => [
      {
        title: "更新时间",
        dataIndex: "updated_at",
        width: 170,
        render: (value: string) => formatChinaTime(value, "YYYY-MM-DD HH:mm:ss"),
      },
      {
        title: "项目",
        key: "project",
        width: 180,
        render: (_, record) => (
          <div className="min-w-0">
            <div className="truncate font-medium">{record.project_name || "—"}</div>
            <div className="truncate text-xs text-gray-500">{record.group_name || "—"}</div>
          </div>
        ),
      },
      {
        title: "参加单位 / 版本",
        key: "company",
        width: 160,
        render: (_, record) => (
          <div>
            <div>{record.company_name || "—"}</div>
            <div className="text-xs text-gray-500">
              {record.version_number ? `V${record.version_number}` : "—"}
            </div>
          </div>
        ),
      },
      {
        title: "问题",
        dataIndex: "issue_id",
        width: 80,
        render: (value: string | null | undefined, record) =>
          record.feedback_type === "report_suggestion" ? "整篇报告" : value || "—",
      },
      {
        title: "类型",
        dataIndex: "feedback_type",
        width: 100,
        render: (value: string) => feedbackTypeLabel(value),
      },
      {
        title: "标签 / 内容",
        key: "content",
        render: (_, record) => (
          <div className="space-y-1">
            {record.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {record.tags.map((tag) => (
                  <Tag key={tag} className="!m-0">
                    {tag}
                  </Tag>
                ))}
              </div>
            )}
            {record.comment && <div className="text-sm text-gray-600">{record.comment}</div>}
          </div>
        ),
      },
      {
        title: "操作",
        key: "actions",
        width: 140,
        fixed: "right",
        render: (_, record) => (
          <Space size={0}>
            {record.report_url && (
              <Link to={record.report_url} target="_blank">
                查看报告
              </Link>
            )}
            {canDeleteEntries && (
              <Popconfirm title="确定删除该反馈？" onConfirm={() => handleDeleteEntry(record.id)}>
                <Button type="link" size="small" danger>
                  删除
                </Button>
              </Popconfirm>
            )}
          </Space>
        ),
      },
    ],
    [canDeleteEntries],
  );

  return (
    <Card bordered={false}>
      <Typography.Title level={4} className="!mb-4">
        反馈管理
      </Typography.Title>
      <Typography.Paragraph type="secondary" className="!mb-4">
        配置报告页问题反馈标签，并查看、追溯各项目收集到的反馈建议。
      </Typography.Paragraph>

      <Tabs
        items={[
          {
            key: "entries",
            label: "反馈记录",
            children: (
              <>
                <Form form={entryForm} layout="inline" className="mb-4 flex flex-wrap gap-y-3">
                  <Form.Item name="keyword">
                    <Input allowClear placeholder="项目 / 单位 / 反馈内容" style={{ width: 240 }} />
                  </Form.Item>
                  <Form.Item name="feedback_type" initialValue="">
                    <Select options={FEEDBACK_TYPE_OPTIONS} style={{ width: 140 }} />
                  </Form.Item>
                  <Form.Item>
                    <Button
                      type="primary"
                      icon={<SearchOutlined />}
                      onClick={() => {
                        setEntryPage(1);
                        loadEntries();
                      }}
                    >
                      查询
                    </Button>
                  </Form.Item>
                </Form>
                <Table
                  rowKey="id"
                  loading={entriesLoading}
                  columns={entryColumns}
                  dataSource={entries}
                  scroll={{ x: 1200 }}
                  pagination={{
                    current: entryPage,
                    pageSize: entryPageSize,
                    total: entryTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条反馈`,
                    onChange: (page, pageSize) => {
                      setEntryPage(page);
                      setEntryPageSize(pageSize);
                    },
                  }}
                />
              </>
            ),
          },
          canManageTags
            ? {
                key: "tags",
                label: "标签配置",
                children: (
                  <>
                    <div className="mb-4 flex justify-end">
                      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateTag}>
                        新建标签
                      </Button>
                    </div>
                    <Table
                      rowKey="id"
                      loading={tagsLoading}
                      columns={tagColumns}
                      dataSource={tags}
                      pagination={false}
                    />
                  </>
                ),
              }
            : null,
        ].filter(isPresent)}
      />

      <Modal
        title={editingTag ? "编辑标签" : "新建标签"}
        open={tagModalOpen}
        confirmLoading={tagSubmitting}
        onCancel={() => {
          if (!tagSubmitting) {
            setTagModalOpen(false);
            setEditingTag(null);
          }
        }}
        onOk={handleTagSubmit}
        destroyOnClose
      >
        <Form form={tagForm} layout="vertical" preserve={false}>
          <Form.Item
            name="feedback_type"
            label="标签类型"
            rules={[{ required: true, message: "请选择标签类型" }]}
          >
            <Select options={TAG_TYPE_OPTIONS} />
          </Form.Item>
          <Form.Item name="label" label="标签名称" rules={[{ required: true, message: "请输入标签名称" }]}>
            <Input maxLength={64} placeholder="例如：定位准确" />
          </Form.Item>
          <Form.Item name="sort_order" label="排序">
            <InputNumber min={0} className="w-full" />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
