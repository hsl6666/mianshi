import { useEffect, useMemo, useState } from "react";
import { BarChartOutlined, EyeOutlined, FileTextOutlined, SaveOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Drawer, Empty, Progress, Space, Table, Tag, message, type TableColumnsType } from "antd";
import dayjs from "dayjs";
import { fetchInterviewResultDetail, fetchInterviewResults } from "../../api";
import { riskConfig } from "../constants";
import { Metric } from "../components/Metric";
import { TalentReport } from "../components/TalentReport";
import type { InterviewResultDetail, InterviewResultSummary, RiskLevel } from "../../types";

export default function TalentManagementPage() {
  const [rows, setRows] = useState<InterviewResultSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<InterviewResultDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const stats = useMemo(() => {
    const total = rows.length;
    const completed = rows.filter((item) => item.status === "completed").length;
    const average = total ? Math.round(rows.reduce((sum, item) => sum + item.total_score, 0) / total) : 0;
    const highRisk = rows.filter((item) => item.risk_level === "high").length;
    return { total, completed, average, highRisk };
  }, [rows]);

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    setLoading(true);
    try {
      setRows(await fetchInterviewResults());
    } catch {
      message.error("加载人才数据失败，请确认后端服务可用");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(row: InterviewResultSummary) {
    setDrawerOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await fetchInterviewResultDetail(row.session_id));
    } catch {
      message.error("加载人才报告失败");
    } finally {
      setDetailLoading(false);
    }
  }

  const columns: TableColumnsType<InterviewResultSummary> = [
    {
      title: "候选人",
      dataIndex: "name",
      fixed: "left",
      width: 180,
      render: (name, row) => (
        <button className="text-left" onClick={() => void openDetail(row)}>
          <div className="text-sm font-semibold text-stone-950">{name}</div>
          <div className="mt-1 text-xs text-stone-500">{row.phone || row.email || "无联系方式"}</div>
        </button>
      ),
    },
    { title: "岗位", dataIndex: "role", width: 190 },
    {
      title: "综合分",
      dataIndex: "total_score",
      width: 150,
      sorter: (a, b) => a.total_score - b.total_score,
      render: (score) => <Progress percent={score} size="small" strokeColor={score >= 70 ? "#14532d" : "#be123c"} />,
    },
    { title: "笔试", dataIndex: "written_score", width: 90 },
    { title: "口试", dataIndex: "oral_score", width: 90 },
    {
      title: "风险",
      dataIndex: "risk_level",
      width: 100,
      render: (risk: RiskLevel) => <Tag color={riskConfig[risk].color}>{riskConfig[risk].label}</Tag>,
    },
    {
      title: "材料",
      width: 170,
      render: (_, row) => (
        <Space size={4} wrap>
          <Tag>{row.attachments_count} 附件</Tag>
          <Tag>{row.recordings_count || 0} 录音</Tag>
        </Space>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 160,
      render: (value) => <span className="text-xs text-stone-500">{dayjs(value).format("YYYY-MM-DD HH:mm")}</span>,
    },
    {
      title: "操作",
      fixed: "right",
      width: 110,
      render: (_, row) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => void openDetail(row)}>
          查看报告
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="候选人数" value={stats.total} icon={<FileTextOutlined />} />
        <Metric label="已完成" value={stats.completed} icon={<SaveOutlined />} />
        <Metric label="平均分" value={stats.average} icon={<BarChartOutlined />} />
        <Metric label="高风险" value={stats.highRisk} icon={<SyncOutlined />} danger />
      </section>

      <section className="rounded-lg border border-stone-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">面试人员信息</h2>
          <Button icon={<SyncOutlined />} onClick={() => void loadRows()}>
            刷新
          </Button>
        </div>
        <Table
          rowKey="session_id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1240 }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无人才数据" /> }}
        />
      </section>

      <Drawer title={detail?.report.title || "人才报告"} size={860} open={drawerOpen} onClose={() => setDrawerOpen(false)} destroyOnHidden>
        {detailLoading ? <Empty description="报告加载中..." /> : detail ? <TalentReport detail={detail} /> : <Empty description="暂无报告" />}
      </Drawer>
    </div>
  );
}
