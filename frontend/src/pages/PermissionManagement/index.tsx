import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Popconfirm,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, SaveOutlined } from "@ant-design/icons";
import {
  createRole,
  deleteRole,
  fetchPermissionCatalog,
  fetchRoles,
  updateRole,
  updateRolePermissions,
  type PermissionModuleItem,
  type RoleItem,
} from "@/api/permissions";
import { ACTION_LABELS, type PermissionModule, type PermissionsMap } from "@/constants/permissions";

interface RoleFormState {
  name: string;
  description?: string;
}

export default function PermissionManagementPage() {
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<PermissionModuleItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [drafts, setDrafts] = useState<Record<number, PermissionsMap>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<RoleFormState>();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogData, roleData] = await Promise.all([fetchPermissionCatalog(), fetchRoles()]);
      setCatalog(catalogData);
      setRoles(roleData);
      setDrafts(
        Object.fromEntries(roleData.map((item) => [item.id, structuredClone(item.permissions)])),
      );
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载权限数据失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const togglePermission = (roleId: number, module: PermissionModule, action: string, checked: boolean) => {
    setDrafts((prev) => {
      const next = structuredClone(prev);
      const current = next[roleId] ?? {};
      const modulePermissions: Record<string, boolean> = { ...(current[module] ?? {}) };
      modulePermissions[action] = checked;
      next[roleId] = { ...current, [module]: modulePermissions };
      return next;
    });
  };

  const handleSavePermissions = async (roleId: number) => {
    const permissions = drafts[roleId];
    if (!permissions) return;
    setSavingId(roleId);
    try {
      await updateRolePermissions(roleId, permissions);
      message.success("权限已保存");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSavingId(null);
    }
  };

  const openCreate = () => {
    setEditingRole(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (record: RoleItem) => {
    setEditingRole(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description ?? undefined,
    });
    setModalOpen(true);
  };

  const handleSubmitRole = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      if (editingRole) {
        await updateRole(editingRole.id, values);
        message.success("角色已更新");
      } else {
        await createRole({
          name: values.name.trim(),
          description: values.description,
          permissions: {},
        });
        message.success("角色已创建");
      }
      setModalOpen(false);
      await loadData();
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roleId: number) => {
    try {
      await deleteRole(roleId);
      message.success("角色已删除");
      await loadData();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const tableScrollX = useMemo(() => {
    const moduleWidth = catalog.reduce(
      (sum, moduleItem) => sum + Math.min(220, 96 + moduleItem.actions.length * 22),
      0,
    );
    return 200 + 88 + 72 + moduleWidth + 96;
  }, [catalog]);

  const columns: ColumnsType<RoleItem> = useMemo(
    () => [
      {
        title: "角色",
        key: "role",
        width: 200,
        fixed: "left",
        onCell: () => ({ className: "bg-white dark:bg-[#141414]" }),
        render: (_, record) => (
          <div className="min-w-[160px]">
            <div className="font-medium">{record.name}</div>
            <div className="text-xs text-gray-500 line-clamp-2">{record.description || record.code}</div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Tag color={record.is_system ? "gold" : "blue"} className="!m-0">
                {record.is_system ? "系统内置" : "自定义"}
              </Tag>
              <span className="text-xs text-gray-400">{record.user_count} 人</span>
            </div>
          </div>
        ),
      },
      ...catalog.map((moduleItem) => ({
        title: moduleItem.label,
        key: moduleItem.module,
        width: Math.min(220, 96 + moduleItem.actions.length * 22),
        render: (_: unknown, record: RoleItem) => {
          const module = moduleItem.module as PermissionModule;
          const draft = drafts[record.id] ?? record.permissions;
          const isSuperAdmin = record.code === "super_admin";
          return (
            <div className="flex max-h-[360px] flex-col gap-1 overflow-y-auto pr-1">
              {moduleItem.actions.map((actionItem) => (
                <Checkbox
                  key={`${record.id}-${module}-${actionItem.action}`}
                  className="!ml-0 !items-start [&_.ant-checkbox+span]:whitespace-nowrap"
                  checked={Boolean((draft?.[module] as Record<string, boolean> | undefined)?.[actionItem.action])}
                  disabled={isSuperAdmin}
                  onChange={(event) =>
                    togglePermission(record.id, module, actionItem.action, event.target.checked)
                  }
                >
                  {ACTION_LABELS[module]?.[actionItem.action] ?? actionItem.label}
                </Checkbox>
              ))}
            </div>
          );
        },
      })),
      {
        title: "操作",
        key: "actions",
        width: 96,
        fixed: "right",
        onCell: () => ({ className: "bg-white dark:bg-[#141414]" }),
        render: (_, record) => (
          <div className="flex w-[88px] flex-col items-start gap-0.5">
            <Button
              type="link"
              size="small"
              className="!h-7 !px-0"
              icon={<EditOutlined />}
              onClick={() => openEdit(record)}
            >
              编辑
            </Button>
            {record.code !== "super_admin" && (
              <Button
                type="link"
                size="small"
                className="!h-7 !px-0"
                icon={<SaveOutlined />}
                loading={savingId === record.id}
                onClick={() => handleSavePermissions(record.id)}
              >
                保存
              </Button>
            )}
            {!record.is_system && (
              <Popconfirm title="确定删除该角色？" onConfirm={() => handleDelete(record.id)}>
                <Button type="link" size="small" danger className="!h-7 !px-0" icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            )}
          </div>
        ),
      },
    ],
    [catalog, drafts, savingId],
  );

  return (
    <Card bordered={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <Typography.Title level={4} className="!mb-1">
            权限管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="!mb-0">
            配置角色可见菜单与各模块操作权限。菜单可见与功能权限相互独立，需同时开启才能访问对应页面。
          </Typography.Paragraph>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新建角色
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={roles}
        pagination={false}
        tableLayout="fixed"
        scroll={{ x: tableScrollX }}
        className="[&_.ant-table-cell-fix-left]:z-[2] [&_.ant-table-cell-fix-right]:z-[2]"
      />

      <Modal
        title={editingRole ? "编辑角色" : "新建角色"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmitRole}
        confirmLoading={submitting}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: "请输入角色名称" }]}>
            <Input placeholder="如：招投标专员" disabled={editingRole?.is_system} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="可选" />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
