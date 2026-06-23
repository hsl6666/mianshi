import { useCallback, useEffect, useState } from "react";
import { Button, Card, Form, Input, Select, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { SearchOutlined } from "@ant-design/icons";
import { formatChinaTime } from "@/utils/date";
import { fetchOperationLogs, type OperationLogItem } from "@/api/auth";

const MODULE_OPTIONS = [
  { value: "", label: "全部模块" },
  { value: "auth", label: "认证" },
  { value: "user", label: "用户" },
  { value: "bidding", label: "招投标" },
];

const ACTION_LABEL: Record<string, string> = {
  login: "登录",
  create: "创建",
  update: "更新",
  delete: "删除",
};

export default function OperationLogsPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<OperationLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const values = form.getFieldsValue();
      const data = await fetchOperationLogs({
        page,
        page_size: pageSize,
        keyword: values.keyword?.trim() || undefined,
        module: values.module || undefined,
        username: values.username?.trim() || undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载日志失败");
    } finally {
      setLoading(false);
    }
  }, [form, page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearch = () => {
    setPage(1);
    loadLogs();
  };

  const columns: ColumnsType<OperationLogItem> = [
    {
      title: "时间",
      dataIndex: "created_at",
      width: 170,
      render: (v: string) => formatChinaTime(v, "YYYY-MM-DD HH:mm:ss"),
    },
    { title: "操作人", dataIndex: "username", width: 100 },
    {
      title: "操作",
      dataIndex: "action",
      width: 80,
      render: (v: string) => ACTION_LABEL[v] || v,
    },
    { title: "模块", dataIndex: "module", width: 120 },
    { title: "摘要", dataIndex: "summary", ellipsis: true },
    { title: "IP", dataIndex: "ip_address", width: 130, render: (v) => v || "—" },
  ];

  return (
    <Card bordered={false}>
      <Typography.Title level={4} className="!mb-4">
        操作日志
      </Typography.Title>
      <Form form={form} layout="inline" className="mb-4 flex flex-wrap gap-y-2">
        <Form.Item name="keyword">
          <Input allowClear placeholder="关键词（摘要）" style={{ width: 180 }} />
        </Form.Item>
        <Form.Item name="username">
          <Input allowClear placeholder="操作人" style={{ width: 120 }} />
        </Form.Item>
        <Form.Item name="module" initialValue="">
          <Select options={MODULE_OPTIONS} style={{ width: 160 }} />
        </Form.Item>
        <Form.Item>
          <Space>
            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
              查询
            </Button>
            <Button
              onClick={() => {
                form.resetFields();
                form.setFieldValue("module", "");
                setPage(1);
                setTimeout(loadLogs, 0);
              }}
            >
              重置
            </Button>
          </Space>
        </Form.Item>
      </Form>
      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={items}
        scroll={{ x: 800 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showTotal: (t) => `共 ${t} 条`,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />
    </Card>
  );
}
