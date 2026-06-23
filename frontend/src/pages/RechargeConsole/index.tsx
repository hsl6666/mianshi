import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Progress,
  Select,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  ArrowUpOutlined,
  BarChartOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CreditCardOutlined,
  DollarOutlined,
  LineChartOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  SendOutlined,
  ThunderboltOutlined,
  WarningOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ReactEcharts } from "@/components/ReactEcharts";
import { fetchUsers, type UserItem } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { formatChinaTime } from "@/utils/date";

type PlanCode = "free" | "pro" | "flagship" | "enterprise";
type AnalysisMode = "consume" | "trend" | "calls" | "ranking";

interface WalletUser {
  id: number;
  username: string;
  displayName: string;
  plan: PlanCode;
  balance: number;
  totalRecharge: number;
  totalConsume: number;
  requestCount: number;
  tokenCount: number;
  rpm: number;
  tpm: number;
  lastRechargeAt: string;
  status: "normal" | "low" | "frozen";
}

interface RechargeRecord {
  id: string;
  username: string;
  displayName: string;
  amount: number;
  plan: PlanCode;
  remark?: string;
  createdAt: string;
}

interface RechargeFormValues {
  userId: number;
  amount: number;
  plan: PlanCode;
  remark?: string;
}

interface ConsoleSummary {
  totalBalance: number;
  totalRecharge: number;
  totalConsume: number;
  requestCount: number;
  tokenCount: number;
  paidUsers: number;
  avgRpm: number;
  avgTpm: number;
  arpu: number;
  repurchaseRate: number;
  paidRate: number;
  consumeRate: number;
  todayRecharge: number;
  lowBalanceCount: number;
}

const planMeta: Record<PlanCode, { label: string; color: string; amount: number }> = {
  free: { label: "免费版", color: "default", amount: 0 },
  pro: { label: "专业版", color: "blue", amount: 299 },
  flagship: { label: "旗舰版", color: "purple", amount: 899 },
  enterprise: { label: "企业版", color: "gold", amount: 4999 },
};

const planOptions = Object.entries(planMeta).map(([value, item]) => ({
  value,
  label: item.label,
}));

const fallbackUsers: UserItem[] = [
  {
    id: 1,
    username: "cqzsxh",
    display_name: "超级管理员",
    role: "super_admin",
    role_id: 1,
    role_name: "超级管理员",
    is_active: true,
    created_at: "2026-06-08T10:00:00",
    updated_at: "2026-06-08T10:00:00",
  },
  {
    id: 2,
    username: "demo_user",
    display_name: "演示客户",
    role: "user",
    role_id: 2,
    role_name: "普通用户",
    is_active: true,
    created_at: "2026-06-08T10:00:00",
    updated_at: "2026-06-08T10:00:00",
  },
];

function money(value: number) {
  return `¥${value.toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function numberText(value: number) {
  return value.toLocaleString("zh-CN");
}

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((value / total) * 100)));
}

function resolveGreeting() {
  const hour = dayjs().hour();
  if (hour < 6) return "凌晨好";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

function buildWalletUsers(users: UserItem[]): WalletUser[] {
  const source = users.length ? users : fallbackUsers;
  return source.map((user, index) => {
    const seed = user.id * 31 + index * 17;
    const plan: PlanCode =
      user.role === "super_admin"
        ? "enterprise"
        : seed % 5 === 0
          ? "flagship"
          : seed % 3 === 0
            ? "pro"
            : "free";
    const totalRecharge = planMeta[plan].amount * (plan === "free" ? 0 : (seed % 4) + 1);
    const totalConsume = Math.min(totalRecharge * (0.28 + (seed % 5) * 0.08), totalRecharge);
    const balance = Math.max(totalRecharge - totalConsume, 0);
    return {
      id: user.id,
      username: user.username,
      displayName: user.display_name?.trim() || user.username,
      plan,
      balance,
      totalRecharge,
      totalConsume,
      requestCount: plan === "free" ? seed % 12 : 120 + seed * 6,
      tokenCount: plan === "free" ? 1800 + seed * 120 : 36000 + seed * 980,
      rpm: plan === "free" ? 0.2 + (seed % 3) * 0.1 : 2.4 + (seed % 8) * 0.35,
      tpm: plan === "free" ? 120 + seed * 3 : 1200 + seed * 42,
      lastRechargeAt: dayjs()
        .subtract((seed % 18) + 1, "day")
        .hour(14 + (seed % 7))
        .minute(12)
        .second(0)
        .toISOString(),
      status: balance <= 50 && plan !== "free" ? "low" : user.is_active ? "normal" : "frozen",
    };
  });
}

function MetricPanel({
  title,
  icon,
  accentClassName = "from-blue-500 via-cyan-400 to-emerald-400",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accentClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-28px_rgba(15,23,42,0.45)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_54px_-34px_rgba(15,23,42,0.5)]">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClassName}`} />
      <div className="flex h-14 items-center gap-3 border-b border-slate-100 px-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-50 text-lg text-slate-900 ring-1 ring-slate-100">
          {icon}
        </span>
        <span className="font-semibold tracking-wide text-slate-900">{title}</span>
      </div>
      <div className="grid gap-5 p-4">{children}</div>
    </section>
  );
}

function MetricLine({
  icon,
  iconClassName,
  label,
  value,
  action,
}: {
  icon: React.ReactNode;
  iconClassName: string;
  label: string;
  value: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-3">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-sm ${iconClassName}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-1 truncate text-[22px] font-bold leading-7 text-slate-950">{value}</div>
      </div>
      {action}
    </div>
  );
}

function HeroMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/82 px-4 py-3 shadow-sm backdrop-blur">
      <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-400">{label}</div>
      <div className="mt-2 truncate text-2xl font-bold text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function ConsoleHero({
  username,
  summary,
  loading,
  onRefresh,
  onRecharge,
}: {
  username: string | null;
  summary: ConsoleSummary;
  loading: boolean;
  onRefresh: () => void;
  onRecharge: () => void;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fbff_42%,#eefdf7_100%)] px-5 py-5 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.65)] md:px-7 md:py-6">
      <div className="pointer-events-none absolute right-[-120px] top-[-150px] h-[320px] w-[320px] rounded-full border-[46px] border-teal-100/70" />
      <div className="pointer-events-none absolute bottom-[-130px] left-[38%] h-[260px] w-[260px] rounded-full border-[38px] border-amber-100/70" />
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-100 bg-white/80 px-3 py-1 text-xs font-medium text-teal-700 shadow-sm">
            <CheckCircleOutlined />
            用户充值与资源消耗控制台
          </div>
          <Typography.Title level={2} className="!mb-0 !mt-4 !text-[28px] !leading-tight md:!text-[40px]">
            {resolveGreeting()}，{username || "管理员"}
          </Typography.Title>
          <div className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
            聚合用户余额、充值流水、模型调用、Token 消耗和性能指标，便于快速完成充值处理与异常账户跟进。
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
              付费率 {summary.paidRate}%
            </span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
              消耗率 {summary.consumeRate}%
            </span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              低余额 {summary.lowBalanceCount} 人
            </span>
          </div>
        </div>
        <Space wrap className="shrink-0">
          <Button
            shape="circle"
            icon={<SearchOutlined />}
            onClick={() => document.getElementById("recharge-user-search")?.focus()}
          />
          <Button shape="circle" icon={<ReloadOutlined />} loading={loading} onClick={onRefresh} />
          <Button type="primary" icon={<PlusOutlined />} onClick={onRecharge}>
            给用户充值
          </Button>
        </Space>
      </div>

      <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <HeroMetric
          label="当前总余额"
          value={money(summary.totalBalance)}
          hint="可继续用于 AI 评审与报告生成"
        />
        <HeroMetric label="今日充值" value={money(summary.todayRecharge)} hint="含页面内新增人工充值" />
        <HeroMetric
          label="付费用户"
          value={`${numberText(summary.paidUsers)} 人`}
          hint={`ARPU ${money(summary.arpu)}`}
        />
        <HeroMetric
          label="调用请求"
          value={numberText(summary.requestCount)}
          hint={`${numberText(summary.tokenCount)} Tokens`}
        />
      </div>
    </section>
  );
}

function AnalysisCard({
  title,
  subtitle,
  active,
  onChange,
  children,
}: {
  title: string;
  subtitle: string;
  active: AnalysisMode;
  onChange: (value: AnalysisMode) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-32px_rgba(15,23,42,0.42)] my-5">
      <div className="flex flex-col gap-4 border-b border-slate-100 bg-slate-50/70 px-4 py-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-lg text-slate-900 shadow-sm ring-1 ring-slate-100">
            <BarChartOutlined />
          </span>
          <div>
            <div className="font-semibold text-slate-950">{title}</div>
            <div className="mt-1 text-xs text-slate-400">{subtitle}</div>
          </div>
        </div>
        <Segmented
          className="max-w-full overflow-x-auto"
          value={active}
          onChange={(value) => onChange(value as AnalysisMode)}
          options={[
            { label: "消耗分布", value: "consume" },
            { label: "消耗趋势", value: "trend" },
            { label: "调用次数分布", value: "calls" },
            { label: "调用次数排行", value: "ranking" },
          ]}
        />
      </div>
      <div className="p-4 md:p-6">{children}</div>
    </section>
  );
}

export default function RechargeConsolePage() {
  const currentUsername = useAuthStore((s) => s.username);
  const [loading, setLoading] = useState(false);
  const [walletUsers, setWalletUsers] = useState<WalletUser[]>([]);
  const [records, setRecords] = useState<RechargeRecord[]>([]);
  const [keyword, setKeyword] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanCode | "all">("all");
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("consume");
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<RechargeFormValues>();

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const users = await fetchUsers();
      setWalletUsers(buildWalletUsers(users));
    } catch (error) {
      setWalletUsers(buildWalletUsers([]));
      message.warning(
        error instanceof Error
          ? `用户列表加载失败，已显示演示数据：${error.message}`
          : "用户列表加载失败，已显示演示数据",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (records.length || !walletUsers.length) return;
    const seeded = walletUsers
      .filter((item) => item.totalRecharge > 0)
      .slice(0, 5)
      .map<RechargeRecord>((item, index) => ({
        id: `seed-${item.id}`,
        username: item.username,
        displayName: item.displayName,
        amount: Math.max(item.totalRecharge / Math.max((index % 3) + 1, 1), 99),
        plan: item.plan,
        remark: "系统初始化充值记录",
        createdAt: dayjs(item.lastRechargeAt).toISOString(),
      }));
    setRecords(seeded);
  }, [records.length, walletUsers]);

  const summary = useMemo<ConsoleSummary>(() => {
    const totalBalance = walletUsers.reduce((sum, item) => sum + item.balance, 0);
    const totalRecharge = walletUsers.reduce((sum, item) => sum + item.totalRecharge, 0);
    const totalConsume = walletUsers.reduce((sum, item) => sum + item.totalConsume, 0);
    const requestCount = walletUsers.reduce((sum, item) => sum + item.requestCount, 0);
    const tokenCount = walletUsers.reduce((sum, item) => sum + item.tokenCount, 0);
    const paidUsers = walletUsers.filter((item) => item.plan !== "free").length;
    const avgRpm = walletUsers.length
      ? walletUsers.reduce((sum, item) => sum + item.rpm, 0) / walletUsers.length
      : 0;
    const avgTpm = walletUsers.length
      ? walletUsers.reduce((sum, item) => sum + item.tpm, 0) / walletUsers.length
      : 0;
    const arpu = walletUsers.length ? totalRecharge / walletUsers.length : 0;
    const repurchaseRate = paidUsers ? Math.round((records.length / Math.max(paidUsers, 1)) * 100) : 0;
    const todayRecharge = records
      .filter((item) => dayjs(item.createdAt).isSame(dayjs(), "day"))
      .reduce((sum, item) => sum + item.amount, 0);
    const lowBalanceCount = walletUsers.filter((item) => item.status === "low").length;
    return {
      totalBalance,
      totalRecharge,
      totalConsume,
      requestCount,
      tokenCount,
      paidUsers,
      avgRpm,
      avgTpm,
      arpu,
      repurchaseRate,
      paidRate: percent(paidUsers, walletUsers.length),
      consumeRate: percent(totalConsume, totalRecharge),
      todayRecharge,
      lowBalanceCount,
    };
  }, [records, walletUsers]);

  const filteredUsers = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    return walletUsers.filter((item) => {
      const matchKeyword =
        !value ||
        item.username.toLowerCase().includes(value) ||
        item.displayName.toLowerCase().includes(value);
      const matchPlan = planFilter === "all" || item.plan === planFilter;
      return matchKeyword && matchPlan;
    });
  }, [keyword, planFilter, walletUsers]);

  const chartOption = useMemo(() => {
    if (analysisMode === "trend") {
      const labels = Array.from({ length: 8 }, (_, index) =>
        dayjs()
          .subtract(7 - index, "day")
          .format("MM-DD"),
      );
      const recharge = labels.map((_, index) => Math.round(summary.totalRecharge * (0.08 + index * 0.015)));
      const consume = labels.map((_, index) => Math.round(summary.totalConsume * (0.06 + index * 0.012)));
      return {
        color: ["#2563eb", "#0f9f8f"],
        tooltip: { trigger: "axis" },
        legend: { bottom: 0, data: ["充值金额", "消耗金额"] },
        grid: { left: 48, right: 24, top: 28, bottom: 56 },
        xAxis: { type: "category", boundaryGap: false, data: labels },
        yAxis: { type: "value", axisLabel: { formatter: (value: number) => `¥${value}` } },
        series: [
          { name: "充值金额", type: "line", smooth: true, areaStyle: { opacity: 0.08 }, data: recharge },
          { name: "消耗金额", type: "line", smooth: true, areaStyle: { opacity: 0.08 }, data: consume },
        ],
      };
    }

    if (analysisMode === "calls") {
      return {
        color: ["#2563eb"],
        tooltip: { trigger: "axis" },
        grid: { left: 48, right: 24, top: 28, bottom: 36 },
        xAxis: { type: "category", data: ["AI评审", "报告生成", "PDF导出", "复评分析", "文件解析"] },
        yAxis: { type: "value" },
        series: [
          {
            type: "bar",
            barWidth: 28,
            data: [42, 31, 22, 18, 14].map((rate) => Math.round(summary.requestCount * rate * 0.01)),
          },
        ],
      };
    }

    if (analysisMode === "ranking") {
      const data = [...walletUsers]
        .sort((a, b) => b.requestCount - a.requestCount)
        .slice(0, 8)
        .reverse();
      return {
        color: ["#0f9f8f"],
        tooltip: { trigger: "axis" },
        grid: { left: 92, right: 32, top: 24, bottom: 24 },
        xAxis: { type: "value" },
        yAxis: { type: "category", data: data.map((item) => item.displayName) },
        series: [{ type: "bar", barWidth: 18, data: data.map((item) => item.requestCount) }],
      };
    }

    const consumeData = [
      { name: "AI评审", value: Math.round(summary.totalConsume * 0.48) },
      { name: "报告生成", value: Math.round(summary.totalConsume * 0.24) },
      { name: "文件解析", value: Math.round(summary.totalConsume * 0.16) },
      { name: "PDF导出", value: Math.round(summary.totalConsume * 0.08) },
      { name: "其他", value: Math.round(summary.totalConsume * 0.04) },
    ];
    return {
      color: ["#2563eb", "#0f9f8f", "#f59e0b", "#ef5da8", "#94a3b8"],
      tooltip: { trigger: "item", formatter: "{b}<br/>¥{c} ({d}%)" },
      legend: { orient: "vertical", right: 10, top: "middle" },
      series: [
        {
          type: "pie",
          radius: ["46%", "72%"],
          center: ["38%", "50%"],
          avoidLabelOverlap: true,
          label: { formatter: "{b}\n{d}%" },
          data: consumeData,
        },
      ],
    };
  }, [analysisMode, summary.requestCount, summary.totalConsume, summary.totalRecharge, walletUsers]);

  const openRecharge = (record?: WalletUser) => {
    form.resetFields();
    form.setFieldsValue({
      userId: record?.id,
      amount: record ? Math.max(planMeta[record.plan].amount, 100) : 299,
      plan: record?.plan === "free" ? "pro" : (record?.plan ?? "pro"),
    });
    setModalOpen(true);
  };

  const handleRecharge = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const target = walletUsers.find((item) => item.id === values.userId);
      if (!target) {
        message.error("请选择充值用户");
        return;
      }
      const now = dayjs().toISOString();
      setWalletUsers((prev) =>
        prev.map((item) =>
          item.id === values.userId
            ? {
                ...item,
                plan: values.plan,
                balance: item.balance + values.amount,
                totalRecharge: item.totalRecharge + values.amount,
                lastRechargeAt: now,
                status: "normal",
              }
            : item,
        ),
      );
      setRecords((prev) => [
        {
          id: `${Date.now()}-${values.userId}`,
          username: target.username,
          displayName: target.displayName,
          amount: values.amount,
          plan: values.plan,
          remark: values.remark,
          createdAt: now,
        },
        ...prev,
      ]);
      message.success("充值记录已添加");
      setModalOpen(false);
    } catch (error) {
      if (error && typeof error === "object" && "errorFields" in error) return;
      message.error(error instanceof Error ? error.message : "充值失败");
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<WalletUser> = [
    {
      title: "用户",
      dataIndex: "displayName",
      width: 190,
      fixed: "left",
      render: (_, record) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{record.displayName}</div>
          <div className="mt-0.5 truncate text-xs text-slate-400">@{record.username}</div>
        </div>
      ),
    },
    {
      title: "当前余额",
      dataIndex: "balance",
      width: 140,
      sorter: (a, b) => a.balance - b.balance,
      render: (value: number, record) => (
        <div>
          <strong className="text-slate-950">{money(value)}</strong>
          <Progress
            className="mt-1"
            percent={percent(record.totalConsume, record.totalRecharge || record.totalConsume)}
            size="small"
            showInfo={false}
            strokeColor={record.status === "low" ? "#f59e0b" : "#0f9f8f"}
            railColor="#eef2f7"
          />
        </div>
      ),
    },
    {
      title: "累计充值",
      dataIndex: "totalRecharge",
      width: 140,
      sorter: (a, b) => a.totalRecharge - b.totalRecharge,
      render: (value: number) => money(value),
    },
    {
      title: "历史消耗",
      dataIndex: "totalConsume",
      width: 140,
      sorter: (a, b) => a.totalConsume - b.totalConsume,
      render: (value: number) => <span className="text-slate-500">{money(value)}</span>,
    },
    {
      title: "套餐",
      dataIndex: "plan",
      width: 110,
      render: (value: PlanCode) => <Tag color={planMeta[value].color}>{planMeta[value].label}</Tag>,
    },
    {
      title: "调用次数",
      dataIndex: "requestCount",
      width: 120,
      sorter: (a, b) => a.requestCount - b.requestCount,
      render: (value: number) => numberText(value),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: WalletUser["status"]) => {
        const meta = {
          normal: { color: "success", text: "正常" },
          low: { color: "warning", text: "余额低" },
          frozen: { color: "default", text: "冻结" },
        }[value];
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: "最近充值",
      dataIndex: "lastRechargeAt",
      width: 160,
      render: (value: string) => formatChinaTime(value, "YYYY-MM-DD HH:mm"),
    },
    {
      title: "操作",
      key: "actions",
      width: 110,
      fixed: "right",
      render: (_, record) => (
        <Button type="link" size="small" icon={<PlusOutlined />} onClick={() => openRecharge(record)}>
          充值
        </Button>
      ),
    },
  ];

  return (
    <div className="min-h-full bg-[#f5f7fb] p-1 text-slate-900 md:p-2">
      <div className="mx-auto max-w-[1600px] space-y-5">
        <ConsoleHero
          username={currentUsername}
          summary={summary}
          loading={loading}
          onRefresh={loadUsers}
          onRecharge={() => openRecharge()}
        />

        <Spin spinning={loading}>
          <div className="space-y-6 md:space-y-7">
            <div className="grid gap-4 xl:grid-cols-4">
              <MetricPanel
                title="账户数据"
                icon={<WalletOutlined />}
                accentClassName="from-blue-500 via-sky-400 to-cyan-300"
              >
                <MetricLine
                  icon={<DollarOutlined />}
                  iconClassName="bg-blue-500"
                  label="当前总余额"
                  value={money(summary.totalBalance)}
                  action={
                    <Button className="shrink-0" type="primary" ghost onClick={() => openRecharge()}>
                      充值
                    </Button>
                  }
                />
                <MetricLine
                  icon={<BarChartOutlined />}
                  iconClassName="bg-rose-400"
                  label="历史消耗"
                  value={money(summary.totalConsume)}
                />
                <Progress
                  percent={summary.consumeRate}
                  size="small"
                  strokeColor="#2563eb"
                  railColor="#eef2f7"
                />
              </MetricPanel>

              <MetricPanel
                title="使用统计"
                icon={<LineChartOutlined />}
                accentClassName="from-emerald-500 via-teal-400 to-cyan-300"
              >
                <MetricLine
                  icon={<SendOutlined />}
                  iconClassName="bg-emerald-400"
                  label="请求次数"
                  value={numberText(summary.requestCount)}
                />
                <MetricLine
                  icon={<ArrowUpOutlined />}
                  iconClassName="bg-cyan-400"
                  label="充值流水"
                  value={numberText(records.length)}
                />
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  <span>付费用户占比</span>
                  <strong>{summary.paidRate}%</strong>
                </div>
              </MetricPanel>

              <MetricPanel
                title="资源消耗"
                icon={<ThunderboltOutlined />}
                accentClassName="from-amber-400 via-orange-300 to-rose-300"
              >
                <MetricLine
                  icon={<CreditCardOutlined />}
                  iconClassName="bg-amber-300"
                  label="统计额度"
                  value={money(summary.totalRecharge)}
                />
                <MetricLine
                  icon={<span className="text-base font-bold">T</span>}
                  iconClassName="bg-rose-400"
                  label="统计 Tokens"
                  value={numberText(summary.tokenCount)}
                />
                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  <span>今日充值</span>
                  <strong>{money(summary.todayRecharge)}</strong>
                </div>
              </MetricPanel>

              <MetricPanel
                title="性能指标"
                icon={<RiseOutlined />}
                accentClassName="from-indigo-400 via-blue-400 to-teal-300"
              >
                <MetricLine
                  icon={<ClockCircleOutlined />}
                  iconClassName="bg-indigo-400"
                  label="平均 RPM"
                  value={summary.avgRpm.toFixed(3)}
                />
                <MetricLine
                  icon={<span className="text-sm font-bold">Ag</span>}
                  iconClassName="bg-orange-300"
                  label="平均 TPM"
                  value={numberText(Math.round(summary.avgTpm))}
                />
                <div
                  className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs ${summary.lowBalanceCount ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {summary.lowBalanceCount ? <WarningOutlined /> : <CheckCircleOutlined />}
                    余额预警
                  </span>
                  <strong>{summary.lowBalanceCount} 人</strong>
                </div>
              </MetricPanel>
            </div>

            <AnalysisCard
              title="模型数据分析"
              subtitle={`总计：${money(summary.totalConsume)}，付费用户 ${numberText(summary.paidUsers)} 人，ARPU ${money(summary.arpu)}`}
              active={analysisMode}
              onChange={setAnalysisMode}
            >
              <div className="h-[430px]">
                <ReactEcharts option={chartOption} renderer="svg" />
              </div>
            </AnalysisCard>

            <div>
              <div aria-hidden className="flex items-center gap-3 px-2 pb-5 pt-1 md:px-4 md:pb-6">
                <span className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-slate-300" />
                <span className="h-1.5 w-20 rounded-full bg-gradient-to-r from-blue-500 via-teal-400 to-amber-300 shadow-[0_6px_18px_-8px_rgba(37,99,235,0.75)]" />
                <span className="h-px flex-1 bg-gradient-to-r from-slate-300 via-slate-200 to-transparent" />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_48px_-34px_rgba(15,23,42,0.45)]">
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">用户充值管理</div>
                      <div className="mt-1 text-xs text-slate-400">
                        管理用户余额、套餐、消耗和最近充值状态
                      </div>
                    </div>
                    <Space wrap>
                      <Input
                        id="recharge-user-search"
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="搜索用户名或显示名称"
                        className="!w-60"
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                      />
                      <Select
                        className="!w-36"
                        value={planFilter}
                        onChange={(value) => setPlanFilter(value)}
                        options={[{ value: "all", label: "全部套餐" }, ...planOptions]}
                      />
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => openRecharge()}>
                        给用户充值
                      </Button>
                    </Space>
                  </div>
                  <Table
                    rowKey="id"
                    columns={columns}
                    dataSource={filteredUsers}
                    pagination={{ pageSize: 8, showSizeChanger: false }}
                    scroll={{ x: 1220 }}
                    rowClassName="align-top"
                  />
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.45)]">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-slate-950">最近充值流水</div>
                      <div className="mt-1 text-xs text-slate-400">当前页面操作会即时进入流水</div>
                    </div>
                    <Tag color="blue">复购率 {Math.min(summary.repurchaseRate, 100)}%</Tag>
                  </div>
                  <div className="space-y-3">
                    {records.slice(0, 8).map((record) => (
                      <div
                        key={record.id}
                        className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-900">{record.displayName}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {formatChinaTime(record.createdAt, "MM-DD HH:mm")}
                            </div>
                          </div>
                          <strong className="shrink-0 text-blue-600">+{money(record.amount)}</strong>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <Tag color={planMeta[record.plan].color}>{planMeta[record.plan].label}</Tag>
                          <span className="truncate text-slate-400">{record.remark || "人工充值"}</span>
                        </div>
                      </div>
                    ))}
                    {!records.length && (
                      <div className="rounded-xl bg-slate-50 py-10 text-center text-slate-400">
                        暂无充值流水
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </Spin>
      </div>

      <Modal
        title="用户充值"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleRecharge}
        confirmLoading={submitting}
        destroyOnHidden
        forceRender
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="userId" label="充值用户" rules={[{ required: true, message: "请选择充值用户" }]}>
            <Select
              showSearch
              placeholder="请选择用户"
              optionFilterProp="label"
              options={walletUsers.map((item) => ({
                value: item.id,
                label: `${item.displayName}（${item.username}）`,
              }))}
            />
          </Form.Item>
          <Form.Item name="plan" label="套餐" rules={[{ required: true, message: "请选择套餐" }]}>
            <Select
              options={planOptions}
              onChange={(value: PlanCode) => {
                const amount = planMeta[value].amount;
                if (amount > 0) form.setFieldValue("amount", amount);
              }}
            />
          </Form.Item>
          <Form.Item name="amount" label="充值金额" rules={[{ required: true, message: "请输入充值金额" }]}>
            <InputNumber
              className="!w-full"
              min={0.01}
              precision={2}
              prefix="¥"
              placeholder="请输入充值金额"
            />
          </Form.Item>
          <Form.Item noStyle shouldUpdate>
            {() => (
              <div className="-mt-3 mb-4 flex flex-wrap gap-2">
                {[99, 299, 899, 1999, 4999].map((amount) => (
                  <Button
                    key={amount}
                    size="small"
                    type={form.getFieldValue("amount") === amount ? "primary" : "default"}
                    onClick={() => form.setFieldValue("amount", amount)}
                  >
                    {money(amount)}
                  </Button>
                ))}
              </div>
            )}
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="如：线下转账、活动赠送、企业版开户等" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
