import { useEffect, useState } from "react";
import { DeleteOutlined, EditOutlined, PlusOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Form, Input, InputNumber, Modal, Space, Switch, Table, message, type TableColumnsType } from "antd";
import dayjs from "dayjs";
import { createAdminPosition, deleteAdminPosition, fetchAdminPositions, updateAdminPosition } from "../../api";
import type { JobPosition, JobPositionCreate } from "../../types";

type PositionFormValues = JobPositionCreate;

export default function PositionsManagementPage() {
  const [rows, setRows] = useState<JobPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<JobPosition | null>(null);
  const [form] = Form.useForm<PositionFormValues>();

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    try {
      setRows(await fetchAdminPositions());
    } catch {
      message.error("加载岗位列表失败，请确认后端服务可用");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ enabled: true, sort_order: 0, description: "" });
    setModalOpen(true);
  }

  function openEdit(row: JobPosition) {
    setEditing(row);
    form.setFieldsValue({
      name: row.name,
      description: row.description,
      enabled: row.enabled,
      sort_order: row.sort_order,
    });
    setModalOpen(true);
  }

  async function savePosition() {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editing) await updateAdminPosition(editing.id, values);
      else await createAdminPosition(values);
      setModalOpen(false);
      await loadRows();
      message.success("岗位已保存");
    } catch (error) {
      const detail =
        typeof error === "object" && error && "response" in error
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      message.error(detail || "保存岗位失败");
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(row: JobPosition) {
    Modal.confirm({
      title: "删除岗位",
      content: `确认删除「${row.name}」？删除后相关下拉选项将不再显示该岗位。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        try {
          await deleteAdminPosition(row.id);
          await loadRows();
          message.success("岗位已删除");
        } catch {
          message.error("删除岗位失败");
          throw new Error("delete position failed");
        }
      },
    });
  }

  const columns: TableColumnsType<JobPosition> = [
    { title: "岗位名称", dataIndex: "name", width: 200 },
    {
      title: "描述",
      dataIndex: "description",
      ellipsis: true,
      render: (value) => <span className="text-sm text-stone-600">{value || "-"}</span>,
    },
    { title: "排序", dataIndex: "sort_order", width: 90 },
    {
      title: "状态",
      dataIndex: "enabled",
      width: 100,
      render: (enabled, row) => (
        <Switch
          checked={enabled}
          checkedChildren="启用"
          unCheckedChildren="停用"
          onChange={async (checked) => {
            try {
              await updateAdminPosition(row.id, { enabled: checked });
              await loadRows();
            } catch {
              message.error("状态更新失败");
            }
          }}
        />
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 170,
      render: (value) => <span className="text-xs text-stone-500">{dayjs(value).format("YYYY-MM-DD HH:mm")}</span>,
    },
    {
      title: "操作",
      fixed: "right",
      width: 120,
      render: (_, row) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Button danger icon={<DeleteOutlined />} onClick={() => confirmDelete(row)} />
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">岗位管理</h2>
            <p className="mt-1 text-sm text-stone-500">维护招聘岗位信息，前台应聘与笔试生成将从此处下拉选择。</p>
          </div>
          <Space>
            <Button icon={<SyncOutlined />} onClick={() => void loadRows()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              新建岗位
            </Button>
          </Space>
        </div>
        <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 10, showSizeChanger: false }} />
      </section>

      <Modal
        title={editing ? "编辑岗位" : "新建岗位"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void savePosition()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item label="岗位名称" name="name" rules={[{ required: true, message: "请输入岗位名称" }]}>
            <Input placeholder="例如：AI应用开发工程师" />
          </Form.Item>
          <Form.Item label="岗位描述" name="description">
            <Input.TextArea rows={3} placeholder="岗位职责、技能要求等（选填）" />
          </Form.Item>
          <div className="grid grid-cols-2 gap-3">
            <Form.Item label="排序" name="sort_order" extra="数字越小越靠前">
              <InputNumber className="w-full" min={0} />
            </Form.Item>
            <Form.Item label="启用" name="enabled" valuePropName="checked">
              <Switch checkedChildren="启用" unCheckedChildren="停用" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
