import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { EditOutlined, PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import {
  createUser,
  deleteUser,
  fetchUsers,
  updateUser,
  type UserFormValues,
  type UserItem,
} from "@/api/auth";
import type { UserRole } from "@/store/authStore";

const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "超级管理员",
  user: "普通用户",
};

interface FormState {
  username: string;
  password?: string;
  role: UserRole;
  display_name?: string;
  is_active: boolean;
}

export default function UserManagementPage() {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);
  const [form] = Form.useForm<FormState>();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载用户失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ role: "user", is_active: true });
    setModalOpen(true);
  };

  const openEdit = (record: UserItem) => {
    setEditing(record);
    form.setFieldsValue({
      username: record.username,
      role: record.role,
      display_name: record.display_name,
      is_active: record.is_active,
      password: undefined,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editing) {
        const payload: Partial<UserFormValues> = {
          role: values.role,
          display_name: values.display_name,
          is_active: values.is_active,
        };
        if (values.password) payload.password = values.password;
        await updateUser(editing.id, payload);
        message.success("用户已更新");
      } else {
        if (!values.password) {
          message.error("请设置密码");
          return;
        }
        await createUser({
          username: values.username.trim(),
          password: values.password,
          role: values.role,
          display_name: values.display_name,
          is_active: values.is_active,
        });
        message.success("用户已创建");
      }
      setModalOpen(false);
      loadUsers();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id);
      message.success("用户已删除");
      loadUsers();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const columns: ColumnsType<UserItem> = [
    { title: "用户名", dataIndex: "username", width: 140 },
    {
      title: "显示名称",
      dataIndex: "display_name",
      width: 140,
      render: (v) => v || "—",
    },
    {
      title: "角色",
      dataIndex: "role",
      width: 120,
      render: (role: UserRole) => (
        <Tag color={role === "super_admin" ? "gold" : "blue"}>{ROLE_LABEL[role]}</Tag>
      ),
    },
    {
      title: "状态",
      dataIndex: "is_active",
      width: 90,
      render: (active: boolean) => (
        <Tag color={active ? "success" : "default"}>{active ? "启用" : "禁用"}</Tag>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "created_at",
      width: 170,
      render: (v: string) => dayjs(v).format("YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "actions",
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
          </Button>
          {record.username !== "cqzsxh" && (
            <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)}>
              <Button type="link" size="small" danger>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <Card bordered={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <Typography.Title level={4} className="!mb-0">
          用户管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建用户
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={users} pagination={false} scroll={{ x: 720 }} />

      <Modal
        title={editing ? "编辑用户" : "新建用户"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input disabled={!!editing} placeholder="登录账号" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editing ? "新密码（留空不修改）" : "密码"}
            rules={editing ? [] : [{ required: true, message: "请输入密码" }, { min: 6, message: "至少 6 位" }]}
          >
            <Input.Password placeholder="至少 6 位" />
          </Form.Item>
          <Form.Item name="display_name" label="显示名称">
            <Input placeholder="可选" />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select
              disabled={editing?.username === "cqzsxh"}
              options={[
                { value: "user", label: ROLE_LABEL.user },
                { value: "super_admin", label: ROLE_LABEL.super_admin },
              ]}
            />
          </Form.Item>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch disabled={editing?.username === "cqzsxh"} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
