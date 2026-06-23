import { useEffect, useMemo, useState } from "react";
import {
  BarChartOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileSearchOutlined,
  RobotOutlined,
  ReloadOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Input,
  message,
  Modal,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from "antd";
import dayjs from "dayjs";
import {
  chatWithInterviewAssistant,
  deleteAllInterviewResults,
  deleteInterviewResult,
  fetchInterviewResultDetail,
  fetchInterviewResults,
  resolveAssetUrl,
} from "../api";
import { InterviewShell } from "../components/InterviewShell";
import type {
  AssistantChatMessage,
  InterviewResultDetail,
  InterviewResultSummary,
  RiskLevel,
} from "../types";

const { TextArea } = Input;
const ALL_CANDIDATES_VALUE = "__all__";

const statusLabels: Record<string, string> = {
  draft: "待完善",
  written_submitted: "笔试完成",
  oral_started: "口试中",
  completed: "已完成",
};

const riskConfig: Record<RiskLevel, { label: string; color: string }> = {
  low: { label: "低风险", color: "green" },
  medium: { label: "中风险", color: "gold" },
  high: { label: "高风险", color: "red" },
};

function buildBasicInfoUrl(sessionId: string) {
  const baseUrl = String(import.meta.env.VITE_APP_BASE_URL || "").replace(/\/$/, "");
  const query = new URLSearchParams({ sessionId, readonly: "1" });
  return `${baseUrl}/interview/basic?${query.toString()}`;
}

function buildResultReviewUrl(sessionId: string, type: "written" | "oral") {
  const baseUrl = String(import.meta.env.VITE_APP_BASE_URL || "").replace(/\/$/, "");
  const query = new URLSearchParams({ sessionId });
  return `${baseUrl}/interview/results/${type}?${query.toString()}`;
}

export function ResultsBoard() {
  const [rows, setRows] = useState<InterviewResultSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<InterviewResultDetail | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantSending, setAssistantSending] = useState(false);
  const [assistantSessionId, setAssistantSessionId] = useState("");
  const [assistantDraft, setAssistantDraft] = useState("");
  const [assistantMessages, setAssistantMessages] = useState<AssistantChatMessage[]>([
    {
      role: "assistant",
      content:
        "我是面试分析助手。你可以问我当前候选人的资料、成绩、风险点、项目经历摘要，也可以让我基于候选人库做只读数据查询和分析。",
    },
  ]);

  const stats = useMemo(() => {
    const total = rows.length;
    const average = total ? Math.round(rows.reduce((sum, item) => sum + item.total_score, 0) / total) : 0;
    const recommended = rows.filter((item) => item.total_score >= 72).length;
    const highRisk = rows.filter((item) => item.risk_level === "high").length;
    return { total, average, recommended, highRisk };
  }, [rows]);

  useEffect(() => {
    if (!assistantSessionId && rows.length) {
      setAssistantSessionId(ALL_CANDIDATES_VALUE);
    }
  }, [assistantSessionId, rows]);

  useEffect(() => {
    void loadResults();
  }, []);

  async function loadResults() {
    setLoading(true);
    try {
      setRows(await fetchInterviewResults());
    } catch {
      message.error("加载面试结果失败，请确认后端服务可用");
    } finally {
      setLoading(false);
    }
  }

  async function openDetail(row: InterviewResultSummary) {
    setAssistantSessionId((current) => (current === ALL_CANDIDATES_VALUE ? current : row.session_id));
    setDrawerOpen(true);
    setDetail(null);
    setDetailLoading(true);
    try {
      setDetail(await fetchInterviewResultDetail(row.session_id));
    } catch {
      message.error("加载成绩分析报告失败");
    } finally {
      setDetailLoading(false);
    }
  }

  function openAssistant() {
    if (!rows.length) {
      message.warning("暂无候选人数据，无法开启分析助手");
      return;
    }
    setAssistantSessionId((current) => current || ALL_CANDIDATES_VALUE);
    setAssistantOpen(true);
  }

  function handleAssistantCandidateChange(value: string) {
    setAssistantSessionId(value);
    setAssistantMessages([
      {
        role: "assistant",
        content:
          value === ALL_CANDIDATES_VALUE
            ? "已切换为全部候选人模式。你可以让我基于全部人员数据做汇总、筛选、对比和分析。"
            : "已切换候选人。你可以继续提问，我会基于当前候选人和候选人库回答。",
      },
    ]);
  }

  async function sendAssistantMessage() {
    const content = assistantDraft.trim();
    if (!content) return;
    if (!assistantSessionId) {
      message.warning("请先选择候选人");
      return;
    }

    const nextMessages: AssistantChatMessage[] = [...assistantMessages, { role: "user", content }];
    setAssistantMessages(nextMessages);
    setAssistantDraft("");
    setAssistantSending(true);
    try {
      const response = await chatWithInterviewAssistant(assistantSessionId, nextMessages);
      setAssistantMessages((items) => [
        ...items,
        {
          role: "assistant",
          content: response.answer,
          sql_used: response.sql_used,
          warning: response.warning,
        },
      ]);
    } catch (error) {
      const detailMessage =
        typeof error === "object" &&
        error &&
        "response" in error &&
        typeof (error as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
          ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : "";
      message.error(detailMessage || "智能体回答失败，请确认模型配置和后端服务可用");
    } finally {
      setAssistantSending(false);
    }
  }

  function confirmDelete(row: InterviewResultSummary) {
    Modal.confirm({
      title: "删除候选人数据",
      content: `删除后将清空 ${row.name || "该候选人"} 的基础信息、笔试、口试、附件、抽帧和录音，且无法恢复。`,
      okText: "删除",
      okType: "danger",
      cancelText: "取消",
      centered: true,
      async onOk() {
        try {
          await deleteInterviewResult(row.session_id);
          setRows((items) => items.filter((item) => item.session_id !== row.session_id));
          if (detail?.summary.session_id === row.session_id) {
            setDrawerOpen(false);
            setDetail(null);
          }
          message.success("候选人数据已删除");
        } catch {
          message.error("删除失败，请确认后端服务可用");
        }
      },
    });
  }

  function confirmDeleteAll() {
    Modal.confirm({
      title: "删除全部候选人",
      content: "删除后将清空所有候选人的基础信息、笔试、口试、附件、抽帧和录音，且无法恢复。",
      okText: "删除全部",
      okType: "danger",
      cancelText: "取消",
      centered: true,
      async onOk() {
        setDeletingAll(true);
        try {
          const result = await deleteAllInterviewResults();
          setRows([]);
          setDrawerOpen(false);
          setDetail(null);
          message.success(`已删除 ${result.deleted_count} 个候选人`);
        } catch {
          message.error("删除全部失败，请确认后端服务可用");
        } finally {
          setDeletingAll(false);
        }
      },
    });
  }

  const columns: TableColumnsType<InterviewResultSummary> = [
    {
      title: "候选人",
      dataIndex: "name",
      fixed: "left",
      width: 180,
      render: (name, row) => (
        <div>
          <button
            className="text-left text-sm font-semibold text-stone-950 hover:text-emerald-800"
            onClick={() => void openDetail(row)}
          >
            {name}
          </button>
          <div className="mt-1 text-xs text-stone-500">{row.phone || row.email || "无联系方式"}</div>
        </div>
      ),
    },
    {
      title: "岗位",
      dataIndex: "role",
      width: 190,
      render: (role) => <span className="text-sm text-stone-700">{role}</span>,
    },
    {
      title: "综合分",
      dataIndex: "total_score",
      width: 170,
      sorter: (a, b) => a.total_score - b.total_score,
      render: (score) => <ScorePill score={score} />,
    },
    {
      title: "笔试",
      dataIndex: "written_score",
      width: 110,
      sorter: (a, b) => a.written_score - b.written_score,
      render: (score) => <Progress percent={score} size="small" strokeColor="#14532d" />,
    },
    {
      title: "口试",
      dataIndex: "oral_score",
      width: 110,
      sorter: (a, b) => a.oral_score - b.oral_score,
      render: (score) => <Progress percent={score} size="small" strokeColor="#0f766e" />,
    },
    {
      title: "风险",
      dataIndex: "risk_level",
      width: 110,
      filters: [
        { text: "低风险", value: "low" },
        { text: "中风险", value: "medium" },
        { text: "高风险", value: "high" },
      ],
      onFilter: (value, row) => row.risk_level === value,
      render: (risk: RiskLevel) => <Tag color={riskConfig[risk].color}>{riskConfig[risk].label}</Tag>,
    },
    {
      title: "结论",
      dataIndex: "recommendation",
      width: 220,
      render: (value) => <span className="text-sm text-stone-700">{value}</span>,
    },
    {
      title: "材料",
      width: 120,
      render: (_, row) => (
        <Space size={6}>
          <Tag>{row.attachments_count} 附件</Tag>
          <Tag>{row.snapshots_count} 抽帧</Tag>
          <Tag>{row.recordings_count || 0} 录音</Tag>
        </Space>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 110,
      render: (status) => (
        <Tag color={status === "completed" ? "green" : "blue"}>{statusLabels[status] || status}</Tag>
      ),
    },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 170,
      sorter: (a, b) => dayjs(a.updated_at).valueOf() - dayjs(b.updated_at).valueOf(),
      render: (value) => (
        <span className="text-xs text-stone-500">{dayjs(value).format("YYYY-MM-DD HH:mm")}</span>
      ),
    },
    {
      title: "操作",
      fixed: "right",
      width: 170,
      render: (_, row) => (
        <Space size={0}>
          <Button type="link" icon={<EyeOutlined />} onClick={() => void openDetail(row)}>
            详情
          </Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => confirmDelete(row)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={<FileSearchOutlined />} label="候选人数" value={stats.total} tone="slate" />
        <MetricCard
          icon={<BarChartOutlined />}
          label="平均综合分"
          value={stats.average}
          tone="green"
          suffix="分"
        />
        <MetricCard icon={<RiseOutlined />} label="建议推进" value={stats.recommended} tone="emerald" />
        <MetricCard icon={<WarningOutlined />} label="高风险" value={stats.highRisk} tone="red" />
      </section>

      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-stone-950">候选人结果表</h2>
            <p className="mt-1 text-sm text-stone-500">评分为 MVP 规则评分，可作为人工复核前的排序依据。</p>
          </div>
          <Space>
            <Button danger icon={<DeleteOutlined />} loading={deletingAll} onClick={confirmDeleteAll}>
              删除全部
            </Button>
            <Button icon={<ReloadOutlined />} onClick={() => void loadResults()}>
              刷新
            </Button>
          </Space>
        </div>
        <Table
          rowKey="session_id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1420 }}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="暂无面试结果" /> }}
        />
      </section>

      <Drawer
        title={detail?.report.title || "成绩分析报告"}
        open={drawerOpen}
        width={860}
        onClose={() => setDrawerOpen(false)}
        destroyOnClose
      >
        {detailLoading ? (
          <div className="flex h-80 items-center justify-center">
            <Spin tip="生成报告中..." />
          </div>
        ) : detail ? (
          <ReportDetail detail={detail} />
        ) : (
          <Empty description="暂无报告数据" />
        )}
      </Drawer>

      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<RobotOutlined />}
        className="!fixed bottom-6 right-6 z-40 !h-14 !w-14 shadow-lg"
        onClick={openAssistant}
      />

      <Modal
        title="面试分析助手"
        open={assistantOpen}
        onCancel={() => setAssistantOpen(false)}
        destroyOnClose={false}
        width={720}
        footer={null}
      >
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[220px_1fr] md:items-center">
            <span className="text-sm font-medium text-stone-700">当前候选人</span>
            <Select
              value={assistantSessionId || undefined}
              placeholder="请选择候选人"
              options={[
                { value: ALL_CANDIDATES_VALUE, label: "全部候选人" },
                ...rows.map((item) => ({
                  value: item.session_id,
                  label: `${item.name || "未命名"} / ${item.role || "未填写岗位"}`,
                })),
              ]}
              onChange={handleAssistantCandidateChange}
            />
          </div>

          <div className="h-[420px] overflow-y-auto rounded-xl border border-stone-200 bg-stone-50 p-4">
            <div className="space-y-3">
              {assistantMessages.map((item, index) => (
                <div
                  key={`${item.role}-${index}`}
                  className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    item.role === "assistant"
                      ? "mr-auto bg-white text-stone-800"
                      : "ml-auto bg-emerald-900 text-emerald-50"
                  }`}
                >
                  <div>{item.content}</div>
                  {item.sql_used ? (
                    <div className="mt-2 rounded-lg bg-stone-100 px-3 py-2 font-mono text-[11px] leading-5 text-stone-600">
                      SQL: {item.sql_used}
                    </div>
                  ) : null}
                </div>
              ))}
              {assistantSending ? (
                <div className="mr-auto max-w-[88%] rounded-2xl bg-white px-4 py-3 text-sm text-stone-500 shadow-sm">
                  正在分析...
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <TextArea
              value={assistantDraft}
              onChange={(event) => setAssistantDraft(event.target.value)}
              rows={4}
              placeholder="例如：总结当前候选人的优势和风险；对比当前候选人与同岗位候选人的综合分、学历和项目背景。"
              onPressEnter={(event) => {
                if (!event.shiftKey) {
                  event.preventDefault();
                  void sendAssistantMessage();
                }
              }}
            />
            <div className="flex justify-end">
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={assistantSending}
                onClick={() => void sendAssistantMessage()}
              >
                发送
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function ResultsPage() {
  return (
    <InterviewShell
      current="done"
      title="面试结果看板"
      description="集中查看候选人的基础资料、笔试、口试和流程合规结果，点击详情查看成绩分析报告。"
    >
      <ResultsBoard />
    </InterviewShell>
  );
}

function MetricCard({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  tone: "slate" | "green" | "emerald" | "red";
}) {
  const toneClass = {
    slate: "bg-stone-950 text-white",
    green: "bg-emerald-950 text-emerald-50",
    emerald: "bg-teal-900 text-teal-50",
    red: "bg-rose-900 text-rose-50",
  }[tone];

  return (
    <div className={`${toneClass} rounded-xl p-5 shadow-sm`}>
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-xs uppercase tracking-[0.22em] opacity-70">{label}</span>
      </div>
      <div className="mt-5 text-3xl font-semibold tracking-normal">
        {value}
        {suffix ? <span className="ml-1 text-base opacity-70">{suffix}</span> : null}
      </div>
    </div>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 82 ? "#14532d" : score >= 65 ? "#a16207" : "#be123c";
  return (
    <div className="flex items-center gap-3">
      <Progress type="circle" percent={score} size={42} strokeColor={color} />
      <span className="text-sm font-semibold text-stone-800">{score} 分</span>
    </div>
  );
}

function ReportDetail({ detail }: { detail: InterviewResultDetail }) {
  const { summary, report, score_breakdown: scores } = detail;
  const risk = riskConfig[summary.risk_level];
  return (
    <div className="space-y-6">
      <Alert
        showIcon
        type={summary.risk_level === "high" ? "warning" : "success"}
        message={report.conclusion}
        description={report.overall_comment}
      />

      <section className="rounded-xl border border-stone-200 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Typography.Title level={4} className="!mb-1">
              {summary.name}
            </Typography.Title>
            <p className="text-sm text-stone-500">{summary.role}</p>
          </div>
          <Space wrap>
            <Button
              href={buildBasicInfoUrl(summary.session_id)}
              target="_blank"
              rel="noreferrer"
              icon={<FileSearchOutlined />}
            >
              查看基础信息
            </Button>
            <Tag color={risk.color}>{risk.label}</Tag>
            <Tag color="blue">{statusLabels[summary.status] || summary.status}</Tag>
          </Space>
        </div>
        <Divider />
        <Descriptions column={2} size="small">
          <Descriptions.Item label="手机号">{summary.phone || "未填写"}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{summary.email || "未填写"}</Descriptions.Item>
          <Descriptions.Item label="附件">{summary.attachments_count}</Descriptions.Item>
          <Descriptions.Item label="摄像头抽帧">{summary.snapshots_count}</Descriptions.Item>
          <Descriptions.Item label="口试录音">{summary.recordings_count || 0}</Descriptions.Item>
          <Descriptions.Item label="QA 轮次">{summary.qa_count}</Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {dayjs(summary.updated_at).format("YYYY-MM-DD HH:mm")}
          </Descriptions.Item>
        </Descriptions>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ScoreBlock label="综合" value={scores.total_score} />
        <ScoreBlock label="资料" value={scores.profile_score} />
        <ScoreBlock
          label="笔试"
          value={scores.written_score}
          actionHref={buildResultReviewUrl(summary.session_id, "written")}
        />
        <ScoreBlock
          label="口试"
          value={scores.oral_score}
          actionHref={buildResultReviewUrl(summary.session_id, "oral")}
        />
      </section>

      <section className="rounded-xl border border-stone-200 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-stone-950">
          <SafetyCertificateOutlined />
          维度分析
        </h3>
        <div className="space-y-4">
          {report.dimension_analysis.map((item) => (
            <div key={item.dimension}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-stone-800">{item.dimension}</span>
                <span className="text-stone-500">{item.score} 分</span>
              </div>
              <Progress percent={item.score} strokeColor="#14532d" />
              <p className="mt-1 text-xs leading-5 text-stone-500">{item.comment}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <ReportList title="主要优势" items={report.strengths} tone="green" />
        <ReportList
          title="风险提示"
          items={report.risks.length ? report.risks : ["暂无明显风险。"]}
          tone="red"
        />
      </section>

      <section className="rounded-xl border border-stone-200 p-5">
        <h3 className="mb-4 text-base font-semibold text-stone-950">口试 QA 记录</h3>
        {report.qa_pairs.length ? (
          <div className="space-y-4">
            {report.qa_pairs.map((item, index) => (
              <div key={`${item.at}-${index}`} className="rounded-lg bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  Question {index + 1}
                </p>
                <p className="mt-2 text-sm leading-6 text-stone-900">{item.question || "系统追问记录缺失"}</p>
                {item.audio_url ? (
                  <div className="mt-3 border-l-2 border-emerald-800 pl-3">
                    <p className="mb-2 text-sm leading-6 text-stone-700">
                      {item.answer}
                      {item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ""}
                    </p>
                    <audio controls src={resolveAssetUrl(item.audio_url)} className="w-full" />
                  </div>
                ) : (
                  <p className="mt-3 border-l-2 border-emerald-800 pl-3 text-sm leading-6 text-stone-700">
                    {item.answer}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无口试 QA" />
        )}
      </section>
    </div>
  );
}

function formatDuration(value: number) {
  const minutes = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function ScoreBlock({ label, value, actionHref }: { label: string; value: number; actionHref?: string }) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        <span className="text-lg font-semibold text-stone-950">{value}</span>
      </div>
      <Progress percent={value} showInfo={false} strokeColor="#14532d" />
      {actionHref ? (
        <Button
          href={actionHref}
          target="_blank"
          rel="noreferrer"
          type="link"
          size="small"
          icon={<EyeOutlined />}
          className="mt-3 !px-0"
        >
          查看
        </Button>
      ) : null}
    </div>
  );
}

function ReportList({ title, items, tone }: { title: string; items: string[]; tone: "green" | "red" }) {
  const dotClass = tone === "green" ? "bg-emerald-700" : "bg-rose-700";
  return (
    <section className="rounded-xl border border-stone-200 p-5">
      <h3 className="mb-4 text-base font-semibold text-stone-950">{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex gap-3 text-sm leading-6 text-stone-700">
            <span className={`${dotClass} mt-2 h-2 w-2 shrink-0 rounded-full`} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
