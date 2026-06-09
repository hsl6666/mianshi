import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Button,
  Card,
  Progress,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CrownOutlined,
  DollarOutlined,
  FileSearchOutlined,
  LineChartOutlined,
  ProjectOutlined,
  ReloadOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from "@ant-design/icons";
import { fetchUsers, type UserItem } from "@/api/auth";
import { ReactEcharts } from "@/components/ReactEcharts";
import { useAuthStore } from "@/store/authStore";
import { fetchProjects } from "../api";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
} from "../types";

const PAGE_SIZE = 50;

const palette = {
  ink: "#0f172a",
  panel: "#ffffff",
  teal: "#0f9f8f",
  cyan: "#0ea5e9",
  blue: "#2563eb",
  amber: "#f59e0b",
  orange: "#f97316",
  red: "#ef4444",
  green: "#22c55e",
  violet: "#7c3aed",
  slate: "#64748b",
};

const coreMetrics = [
  { label: "累计注册用户", value: "12,568", hint: "全量用户池", icon: <TeamOutlined />, tone: "teal" },
  { label: "付费用户", value: "2,136", hint: "订阅与企业用户", icon: <CrownOutlined />, tone: "amber" },
  { label: "付费转化率", value: "17%", hint: "注册到付费", icon: <RiseOutlined />, tone: "green" },
  { label: "累计项目", value: "58,921", hint: "历史项目库", icon: <ProjectOutlined />, tone: "cyan" },
  { label: "累计分析文件", value: "126,320", hint: "技术标与附件", icon: <FileSearchOutlined />, tone: "blue" },
  { label: "累计发现问题", value: "1,286,521", hint: "AI 风险识别", icon: <SafetyCertificateOutlined />, tone: "red" },
  { label: "累计提分", value: "+182,362", hint: "模拟优化空间", icon: <LineChartOutlined />, tone: "green" },
  { label: "本月收入", value: "¥286,320", hint: "环比 +40%", icon: <DollarOutlined />, tone: "orange" },
] as const;

const pulseMetrics = [
  { label: "今日收入", value: "¥12,860", trend: "+18.4%" },
  { label: "新增用户", value: "328", trend: "+11.2%" },
  { label: "今日分析项目", value: "128", trend: "+9.6%" },
  { label: "复评率", value: "36%", trend: "+4.1%" },
  { label: "7日留存", value: "62%", trend: "+3.8%" },
  { label: "热门功能", value: "AI技术标评审", trend: "72%" },
] as const;

const revenueTrend = [
  ["Jul", 2],
  ["Aug", 3],
  ["Sep", 3.8],
  ["Oct", 4.5],
  ["Nov", 5.2],
  ["Dec", 6.2],
  ["Jan", 5],
  ["Feb", 8],
  ["Mar", 12],
  ["Apr", 15],
  ["May", 20],
  ["Jun", 28],
] as const;

const revenueSources = [
  { name: "会员订阅", value: 72 },
  { name: "单次评审", value: 18 },
  { name: "兑换码", value: 6 },
  { name: "企业版", value: 4 },
];

const growthFunnel = [
  { name: "访问用户", value: 18_231 },
  { name: "注册", value: 6_821 },
  { name: "上传文件", value: 4_120 },
  { name: "查看报告", value: 3_280 },
  { name: "付费", value: 1_035 },
];

const functionUsage = [
  { name: "AI技术标评审", value: 72 },
  { name: "报告下载", value: 56 },
  { name: "复评修稿", value: 49 },
  { name: "项目文件管理", value: 36 },
  { name: "邀请裂变", value: 21 },
];

const projectAnalysisMetrics = [
  { label: "今日分析项目", value: "128", suffix: "个" },
  { label: "本月分析项目", value: "3,821", suffix: "个" },
  { label: "平均评分", value: "82.6", suffix: "分" },
  { label: "平均提分", value: "+4.2", suffix: "分" },
  { label: "平均复评次数", value: "2.8", suffix: "次" },
];

const projectTypes = [
  { name: "道路工程", value: 32 },
  { name: "房建工程", value: 28 },
  { name: "水利工程", value: 18 },
  { name: "市政工程", value: 15 },
  { name: "园林工程", value: 7 },
];

const aiEffectMetrics = [
  { label: "平均发现问题", value: "9.2", suffix: "项" },
  { label: "平均建议", value: "12.4", suffix: "条" },
  { label: "平均提分", value: "4.8", suffix: "分" },
  { label: "模拟评分误差", value: "±2.3", suffix: "分" },
];

const problemRisks = [
  { name: "风险应对不足", value: 38 },
  { name: "量化指标不足", value: 31 },
  { name: "项目响应度不足", value: 18 },
  { name: "逻辑不一致", value: 8 },
  { name: "格式风险", value: 5 },
];

const memberPlans = [
  { name: "免费用户", value: 10_325, color: palette.slate },
  { name: "专业版", value: 1_821, color: palette.teal },
  { name: "旗舰版", value: 315, color: palette.amber },
  { name: "企业版", value: 12, color: palette.violet },
];

const memberTrend = [
  ["Jan", 920],
  ["Feb", 1120],
  ["Mar", 1350],
  ["Apr", 1610],
  ["May", 1908],
  ["Jun", 2148],
] as const;

const inviteMetrics = [
  { label: "邀请人数", value: "1,286", icon: <UserAddOutlined /> },
  { label: "成功注册", value: "826", icon: <TeamOutlined /> },
  { label: "成功付费", value: "235", icon: <CrownOutlined /> },
  { label: "裂变收入", value: "¥35,200", icon: <DollarOutlined /> },
];

interface RankingRow {
  key: string;
  name: string;
  value: string;
  extra: string;
}

const rankingGroups: Record<string, { label: string; rows: RankingRow[] }> = {
  projects: {
    label: "分析项目TOP10",
    rows: [
      ["长丰县农产品仓储中心", "428次", "复评率 42%"],
      ["庐阳区道路改造工程", "386次", "平均提分 +5.1"],
      ["肥西水利治理项目", "352次", "付费转化 31%"],
      ["蜀山区房建施工项目", "318次", "报告查看 91%"],
      ["包河市政管网工程", "285次", "复评 2.9次"],
      ["瑶海园林提升工程", "244次", "平均提分 +4.4"],
      ["高新区厂房建设", "219次", "企业用户"],
      ["经开区桥梁工程", "196次", "报告下载 86%"],
      ["新站道路维修", "172次", "问题 11.2项"],
      ["巢湖排水工程", "146次", "评分 84.8"],
    ].map(([name, value, extra], index) => ({ key: `project-${index}`, name, value, extra })),
  },
  users: {
    label: "用户TOP10",
    rows: [
      ["安徽建工咨询", "1,826次", "企业版"],
      ["合肥投标研究院", "1,354次", "旗舰版"],
      ["中标助手工作室", "1,102次", "专业版"],
      ["招采服务中心", "986次", "复评 422次"],
      ["工程咨询一部", "875次", "留存 83%"],
      ["皖北代理机构", "742次", "付费 18月"],
      ["市政标书团队", "690次", "报告 614份"],
      ["房建投标组", "536次", "评分 85.1"],
      ["水利咨询团队", "421次", "邀请 82人"],
      ["园林服务商", "318次", "问题 3,214项"],
    ].map(([name, value, extra], index) => ({ key: `user-${index}`, name, value, extra })),
  },
  revenue: {
    label: "收入TOP10",
    rows: [
      ["安徽建工咨询", "¥42,800", "企业版续费"],
      ["合肥投标研究院", "¥31,600", "旗舰版"],
      ["中标助手工作室", "¥28,900", "会员订阅"],
      ["招采服务中心", "¥24,300", "单次评审"],
      ["市政标书团队", "¥19,860", "复评包"],
      ["皖北代理机构", "¥18,500", "企业席位"],
      ["工程咨询一部", "¥15,920", "报告下载"],
      ["房建投标组", "¥12,780", "专业版"],
      ["水利咨询团队", "¥10,640", "兑换码"],
      ["园林服务商", "¥8,920", "单次评审"],
    ].map(([name, value, extra], index) => ({ key: `revenue-${index}`, name, value, extra })),
  },
  invites: {
    label: "邀请TOP10",
    rows: [
      ["安徽建工咨询", "128人", "付费 39人"],
      ["中标助手工作室", "112人", "裂变 ¥6,200"],
      ["招采服务中心", "96人", "注册 74人"],
      ["合肥投标研究院", "88人", "付费 22人"],
      ["市政标书团队", "72人", "裂变 ¥4,980"],
      ["工程咨询一部", "66人", "注册 41人"],
      ["皖北代理机构", "58人", "付费 15人"],
      ["房建投标组", "49人", "裂变 ¥2,700"],
      ["水利咨询团队", "36人", "注册 24人"],
      ["园林服务商", "31人", "付费 8人"],
    ].map(([name, value, extra], index) => ({ key: `invite-${index}`, name, value, extra })),
  },
};

interface DashboardSummary {
  groups: BiddingProjectGroupTreeItem[];
  projects: BiddingProjectListItem[];
  companies: BiddingCompanyListItem[];
  versions: BidVersionListItem[];
  analyzedVersions: number;
  reportVersions: number;
  repeatRate: number;
  averageScore: number | null;
}

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function average(values: number[]) {
  if (!values.length) return null;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

async function fetchAllProjectGroups(owner?: string) {
  const firstPage = await fetchProjects({ page: 1, page_size: PAGE_SIZE, owner });
  const pageCount = Math.ceil(firstPage.total / PAGE_SIZE);
  if (pageCount <= 1) return firstPage.items;

  const restPages = await Promise.all(
    Array.from({ length: pageCount - 1 }, (_, index) =>
      fetchProjects({ page: index + 2, page_size: PAGE_SIZE, owner }),
    ),
  );
  return [firstPage, ...restPages].flatMap((page) => page.items);
}

function buildDashboardSummary(groups: BiddingProjectGroupTreeItem[]): DashboardSummary {
  const projects = groups.flatMap((group) => group.children);
  const companies = projects.flatMap((project) => project.children);
  const versions = companies.flatMap((company) => company.children);
  const scoreValues = [
    ...versions.map((version) => version.report_final_score).filter(isValidNumber),
    ...companies.map((company) => company.final_score).filter(isValidNumber),
  ];
  const repeatCompanies = companies.filter((company) => company.children.length > 1).length;

  return {
    groups,
    projects,
    companies,
    versions,
    analyzedVersions: versions.filter((version) => version.analysis_status).length,
    reportVersions: versions.filter((version) => version.report_original_name || version.report_has_data).length,
    repeatRate: percent(repeatCompanies, companies.length),
    averageScore: average(scoreValues),
  };
}

function SectionTitle({
  index,
  title,
  subtitle,
}: {
  index: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <div className="text-xs font-semibold tracking-[0.2em] text-teal-600">{index}</div>
        <Typography.Title level={3} className="!mb-0 !mt-1 !text-xl !font-bold !text-slate-950">
          {title}
        </Typography.Title>
        {subtitle && <p className="mb-0 mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function ExecutiveCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: string;
}) {
  const toneMap: Record<string, string> = {
    teal: "bg-teal-50 text-teal-700 ring-teal-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    cyan: "bg-sky-50 text-sky-700 ring-sky-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
  };

  return (
    <Card bordered={false} className="min-w-0 shadow-sm" bodyStyle={{ padding: 18 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-500">{label}</div>
          <div className="mt-3 whitespace-nowrap text-2xl font-bold leading-none text-slate-950 md:text-[28px]">
            {value}
          </div>
          <div className="mt-3 text-xs text-slate-400">{hint}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ring-1 ${toneMap[tone]}`}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

function MetricMiniCard({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-3 flex items-end gap-1">
        <span className="text-3xl font-bold leading-none text-slate-950">{value}</span>
        <span className="text-sm font-medium text-slate-400">{suffix}</span>
      </div>
    </div>
  );
}

function ChartPanel({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card bordered={false} className={`min-w-0 shadow-sm ${className ?? ""}`} bodyStyle={{ padding: 20 }}>
      <div className="mb-4">
        <div className="text-base font-bold text-slate-950">{title}</div>
        {subtitle && <div className="mt-1 text-xs leading-5 text-slate-400">{subtitle}</div>}
      </div>
      {children}
    </Card>
  );
}

function DashboardHero({ summary }: { summary: DashboardSummary }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-[#101820] p-6 text-white shadow-xl md:p-8">
      <div className="grid gap-6 xl:grid-cols-[1fr_640px]">
        <div>
          <Tag color="cyan" className="!mb-4">
            CEO DASHBOARD
          </Tag>
          <Typography.Title level={1} className="!mb-3 !text-2xl !font-bold !leading-tight !text-white md:!text-4xl">
            经营数据总览
          </Typography.Title>
          <p className="mb-0 max-w-3xl text-sm leading-7 text-slate-200">
            老板打开页面后，第一屏直接看收入、用户、项目分析、复评、留存和功能热度；下面按收入、增长、AI评审效果、会员运营和排行榜继续拆解。
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-slate-300">
            <span className="rounded-full bg-white/10 px-3 py-1">当前项目库：{formatNumber(summary.projects.length)} 项</span>
            <span className="rounded-full bg-white/10 px-3 py-1">
              已分析文件：{formatNumber(summary.analyzedVersions)} 份
            </span>
            <span className="rounded-full bg-white/10 px-3 py-1">当前复评率：{summary.repeatRate}%</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {pulseMetrics.map((item) => (
            <div key={item.label} className="rounded-xl border border-white/10 bg-white/[0.08] p-4">
              <div className="text-xs text-slate-300">{item.label}</div>
              <div className="mt-2 truncate text-2xl font-bold">{item.value}</div>
              <div className="mt-2 text-xs font-semibold text-emerald-300">{item.trend}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function WorkbenchPage() {
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<BiddingProjectGroupTreeItem[]>([]);
  const [ownerFilter, setOwnerFilter] = useState("");
  const [userOptions, setUserOptions] = useState<UserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAllProjectGroups(isSuperAdmin && ownerFilter ? ownerFilter : undefined);
      setGroups(data);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载 Dashboard 数据失败");
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, ownerFilter]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setOwnerFilter("");
      setUserOptions([]);
      return;
    }
    let ignore = false;
    setUserLoading(true);
    fetchUsers()
      .then((users) => {
        if (!ignore) setUserOptions(users);
      })
      .catch((error) => {
        if (!ignore) message.error(error instanceof Error ? error.message : "加载用户列表失败");
      })
      .finally(() => {
        if (!ignore) setUserLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [isSuperAdmin]);

  const summary = useMemo(() => buildDashboardSummary(groups), [groups]);

  const revenueTrendOption = useMemo(
    () => ({
      animation: false,
      color: [palette.teal],
      tooltip: { trigger: "axis", valueFormatter: (value: number) => `${value}万` },
      grid: { left: 42, right: 18, top: 24, bottom: 34 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: revenueTrend.map(([month]) => month),
        axisLine: { lineStyle: { color: "#d7dee8" } },
        axisLabel: { color: "#64748b" },
      },
      yAxis: {
        type: "value",
        axisLabel: { color: "#64748b", formatter: "{value}万" },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      series: [
        {
          name: "收入",
          type: "line",
          smooth: true,
          symbolSize: 8,
          data: revenueTrend.map(([, value]) => value),
          lineStyle: { width: 4 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(15, 159, 143, 0.26)" },
                { offset: 1, color: "rgba(15, 159, 143, 0.02)" },
              ],
            },
          },
        },
      ],
    }),
    [],
  );

  const revenueSourceOption = useMemo(
    () => ({
      animation: false,
      color: [palette.teal, palette.cyan, palette.amber, palette.violet],
      tooltip: { trigger: "item", formatter: "{b}: {c}%" },
      legend: { bottom: 0, textStyle: { color: "#64748b" } },
      series: [
        {
          type: "pie",
          radius: ["58%", "78%"],
          center: ["50%", "42%"],
          label: { formatter: "{b}\n{c}%", color: "#334155" },
          data: revenueSources,
        },
      ],
    }),
    [],
  );

  const growthFunnelOption = useMemo(
    () => ({
      animation: false,
      color: [palette.teal, palette.green, palette.cyan, palette.amber, palette.orange],
      tooltip: { trigger: "item", formatter: "{b}: {c}" },
      series: [
        {
          type: "funnel",
          left: "8%",
          top: 10,
          bottom: 10,
          width: "84%",
          sort: "descending",
          gap: 8,
          label: {
            position: "inside",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            formatter: (params: { name: string; value: number }) => `${params.name}\n${formatNumber(params.value)}`,
          },
          labelLine: { show: false },
          itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 8 },
          data: growthFunnel.map((item) => ({ name: item.name, value: item.value })),
        },
      ],
    }),
    [],
  );

  const functionUsageOption = useMemo(
    () => ({
      animation: false,
      color: [palette.blue],
      tooltip: { trigger: "axis" },
      grid: { left: 104, right: 24, top: 8, bottom: 18 },
      xAxis: {
        type: "value",
        max: 80,
        axisLabel: { color: "#64748b", formatter: "{value}%" },
        splitLine: { lineStyle: { color: "#eef2f7" } },
      },
      yAxis: {
        type: "category",
        data: functionUsage.map((item) => item.name).reverse(),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#334155" },
      },
      series: [
        {
          type: "bar",
          barWidth: 14,
          data: functionUsage.map((item) => item.value).reverse(),
          label: { show: true, position: "right", formatter: "{c}%", color: "#334155", fontWeight: 700 },
          itemStyle: { borderRadius: [0, 10, 10, 0] },
        },
      ],
    }),
    [],
  );

  const analysisTrendOption = useMemo(
    () => ({
      animation: false,
      color: [palette.cyan, palette.teal],
      tooltip: { trigger: "axis" },
      legend: { top: 0, right: 0, textStyle: { color: "#64748b" } },
      grid: { left: 42, right: 18, top: 46, bottom: 32 },
      xAxis: {
        type: "category",
        data: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
        axisLine: { lineStyle: { color: "#d7dee8" } },
        axisLabel: { color: "#64748b" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#eef2f7" } },
        axisLabel: { color: "#64748b" },
      },
      series: [
        {
          name: "分析项目",
          type: "bar",
          barWidth: 20,
          data: [112, 126, 118, 136, 149, 96, 128],
          itemStyle: { borderRadius: [8, 8, 0, 0] },
        },
        {
          name: "复评项目",
          type: "line",
          smooth: true,
          symbolSize: 7,
          data: [36, 41, 38, 44, 52, 31, 46],
          lineStyle: { width: 3 },
        },
      ],
    }),
    [],
  );

  const projectTypeOption = useMemo(
    () => ({
      animation: false,
      color: [palette.teal, palette.cyan, palette.blue, palette.amber, palette.green],
      tooltip: { trigger: "item", formatter: "{b}: {c}%" },
      legend: { orient: "vertical", right: 8, top: "middle", textStyle: { color: "#64748b" } },
      series: [
        {
          type: "pie",
          radius: ["46%", "72%"],
          center: ["38%", "50%"],
          label: { formatter: "{b}\n{c}%", color: "#334155" },
          data: projectTypes,
        },
      ],
    }),
    [],
  );

  const aiRadarOption = useMemo(
    () => ({
      animation: false,
      color: [palette.teal],
      radar: {
        radius: "68%",
        indicator: [
          { name: "问题识别", max: 100 },
          { name: "建议质量", max: 100 },
          { name: "提分效果", max: 100 },
          { name: "评分稳定", max: 100 },
          { name: "报告可读", max: 100 },
        ],
        axisName: { color: "#334155" },
        splitLine: { lineStyle: { color: "#dbe7e5" } },
        splitArea: { areaStyle: { color: ["#ffffff", "#f0fdfa"] } },
      },
      series: [
        {
          type: "radar",
          data: [
            {
              value: [92, 88, 86, 81, 90],
              areaStyle: { color: "rgba(15, 159, 143, 0.22)" },
              lineStyle: { width: 3 },
            },
          ],
        },
      ],
    }),
    [],
  );

  const problemHeatmapOption = useMemo(() => {
    const xLabels = problemRisks.map((item) => item.name);
    const yLabels = ["道路", "房建", "水利", "市政", "园林"];
    const values = [
      [38, 31, 18, 8, 5],
      [34, 35, 16, 10, 5],
      [42, 28, 19, 7, 4],
      [36, 33, 17, 9, 5],
      [29, 38, 20, 8, 5],
    ];
    return {
      animation: false,
      tooltip: { position: "top", formatter: (params: { value: [number, number, number] }) => `${params.value[2]}%` },
      grid: { left: 58, right: 24, top: 18, bottom: 84 },
      xAxis: {
        type: "category",
        data: xLabels,
        axisLabel: { color: "#334155", interval: 0, rotate: 28 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category",
        data: yLabels,
        axisLabel: { color: "#334155" },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      visualMap: {
        min: 0,
        max: 45,
        calculable: false,
        orient: "horizontal",
        left: "center",
        bottom: 10,
        inRange: { color: ["#ecfeff", "#5eead4", "#0f766e"] },
        textStyle: { color: "#64748b" },
      },
      series: [
        {
          type: "heatmap",
          data: values.flatMap((row, yIndex) => row.map((value, xIndex) => [xIndex, yIndex, value])),
          label: { show: true, formatter: (params: { value: [number, number, number] }) => `${params.value[2]}%` },
          itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 6 },
        },
      ],
    };
  }, []);

  const memberTrendOption = useMemo(
    () => ({
      animation: false,
      color: [palette.teal, palette.violet],
      tooltip: { trigger: "axis" },
      grid: { left: 44, right: 18, top: 18, bottom: 34 },
      xAxis: {
        type: "category",
        data: memberTrend.map(([month]) => month),
        axisLine: { lineStyle: { color: "#d7dee8" } },
        axisLabel: { color: "#64748b" },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#eef2f7" } },
        axisLabel: { color: "#64748b" },
      },
      series: [
        {
          type: "line",
          smooth: true,
          symbolSize: 7,
          data: memberTrend.map(([, value]) => value),
          lineStyle: { width: 4 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(124, 58, 237, 0.22)" },
                { offset: 1, color: "rgba(124, 58, 237, 0.02)" },
              ],
            },
          },
        },
      ],
    }),
    [],
  );

  const inviteOption = useMemo(
    () => ({
      animation: false,
      color: [palette.green],
      tooltip: { trigger: "axis" },
      grid: { left: 66, right: 24, top: 18, bottom: 28 },
      xAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#eef2f7" } },
        axisLabel: { color: "#64748b" },
      },
      yAxis: {
        type: "category",
        data: ["成功付费", "成功注册", "邀请人数"],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#334155" },
      },
      series: [
        {
          type: "bar",
          barWidth: 18,
          data: [235, 826, 1286],
          label: { show: true, position: "right", color: "#334155", fontWeight: 700 },
          itemStyle: { borderRadius: [0, 10, 10, 0] },
        },
      ],
    }),
    [],
  );

  const rankingColumns = useMemo<ColumnsType<RankingRow>>(
    () => [
      {
        title: "排名",
        width: 70,
        render: (_, __, index) => (
          <span className={`font-bold ${index < 3 ? "text-orange-500" : "text-slate-500"}`}>#{index + 1}</span>
        ),
      },
      {
        title: "名称",
        dataIndex: "name",
        ellipsis: true,
        render: (value: string) => <span className="font-semibold text-slate-900">{value}</span>,
      },
      { title: "数据", dataIndex: "value", width: 130, render: (value: string) => <strong>{value}</strong> },
      { title: "说明", dataIndex: "extra", width: 150, render: (value: string) => <span className="text-slate-500">{value}</span> },
    ],
    [],
  );

  return (
    <div className="min-h-full bg-[#f4f7fb] p-1 text-slate-800 md:p-2">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <DashboardHero summary={summary} />

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-base font-semibold text-slate-950">经营 Dashboard</div>
            <div className="mt-1 text-xs text-slate-400">收入、增长、AI评审、会员运营和排行榜集中呈现</div>
          </div>
          <Space wrap>
            {isSuperAdmin && (
              <Select
                allowClear
                showSearch
                placeholder="按用户筛选项目库"
                className="!w-56"
                loading={userLoading}
                value={ownerFilter || undefined}
                optionFilterProp="label"
                onChange={(value) => setOwnerFilter(value || "")}
                options={userOptions.map((user) => {
                  const displayName = user.display_name?.trim();
                  const label = displayName && displayName !== user.username ? `${displayName}（${user.username}）` : user.username;
                  return { value: user.username, label };
                })}
              />
            )}
            <Button icon={<ReloadOutlined />} onClick={loadDashboard} loading={loading}>
              刷新项目数据
            </Button>
          </Space>
        </div>

        <Spin spinning={loading}>
          <section>
            <SectionTitle index="01" title="核心经营指标" subtitle="第一屏只放老板最关心的大数字，30秒内完成经营判断。" />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {coreMetrics.map((item) => (
                <ExecutiveCard key={item.label} {...item} />
              ))}
            </div>
          </section>

          <section>
            <SectionTitle index="02" title="收入驾驶舱" subtitle="收入趋势和收入结构是 CEO 最重要的判断入口。" />
            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.8fr]">
              <ChartPanel title="近12个月收入趋势" subtitle="单位：万元，Jun 已达到 28 万">
                <div className="h-[360px]">
                  <ReactEcharts option={revenueTrendOption} renderer="svg" />
                </div>
              </ChartPanel>
              <ChartPanel title="收入来源" subtitle="会员订阅仍是主收入引擎">
                <div className="h-[360px]">
                  <ReactEcharts option={revenueSourceOption} renderer="svg" />
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <SectionTitle index="03" title="用户增长" subtitle="漏斗直接暴露访问、注册、上传、查看报告、付费之间的流失。" />
            <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
              <ChartPanel title="增长漏斗" subtitle="老板一眼看到哪里流失">
                <div className="h-[360px]">
                  <ReactEcharts option={growthFunnelOption} renderer="svg" />
                </div>
              </ChartPanel>
              <ChartPanel title="功能热度" subtitle="哪些功能最受欢迎，用于决定产品和训练重点">
                <div className="h-[360px]">
                  <ReactEcharts option={functionUsageOption} renderer="svg" />
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <SectionTitle index="04" title="项目分析数据" subtitle="平台最核心的业务产能数据。" />
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.4fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {projectAnalysisMetrics.map((item) => (
                  <MetricMiniCard key={item.label} {...item} />
                ))}
              </div>
              <ChartPanel title="本周分析与复评趋势" subtitle="分析项目和复评项目同时增长，说明用户开始形成闭环使用习惯">
                <div className="h-[320px]">
                  <ReactEcharts option={analysisTrendOption} renderer="svg" />
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <SectionTitle index="05" title="项目类型分布" subtitle="行业分布决定后续经验库和模型训练重点。" />
            <ChartPanel title="工程类型占比" subtitle="道路工程和房建工程占比最高，优先强化这两类知识库">
              <div className="h-[380px]">
                <ReactEcharts option={projectTypeOption} renderer="svg" />
              </div>
            </ChartPanel>
          </section>

          <section>
            <SectionTitle index="06" title="AI评审效果" subtitle="这是平台核心竞争力，展示 AI 能发现多少问题、给多少建议、能带来多少提分。" />
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {aiEffectMetrics.map((item) => (
                  <MetricMiniCard key={item.label} {...item} />
                ))}
              </div>
              <ChartPanel title="AI评审能力雷达" subtitle="未来可接入真实评分数据，持续校准模拟评分误差">
                <div className="h-[320px]">
                  <ReactEcharts option={aiRadarOption} renderer="svg" />
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <SectionTitle index="07" title="问题热力图" subtitle="统计所有项目的高频问题，反推经验库和训练方向。" />
            <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
              <ChartPanel title="行业 × 问题类型热力图" subtitle="颜色越深，问题越集中">
                <div className="h-[380px]">
                  <ReactEcharts option={problemHeatmapOption} renderer="svg" />
                </div>
              </ChartPanel>
              <Card bordered={false} className="shadow-sm" bodyStyle={{ padding: 20 }}>
                <div className="mb-4 text-base font-bold text-slate-950">高频问题占比</div>
                <div className="space-y-5">
                  {problemRisks.map((item) => (
                    <div key={item.name}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-700">{item.name}</span>
                        <strong>{item.value}%</strong>
                      </div>
                      <Progress percent={item.value} showInfo={false} strokeColor={item.value > 30 ? palette.red : palette.teal} />
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
                  主要流失点集中在风险应对和量化指标，两项合计 69%，经验库优先围绕这两类问题训练。
                </div>
              </Card>
            </div>
          </section>

          <section>
            <SectionTitle index="08" title="会员运营" subtitle="会员结构和会员趋势决定长期收入稳定性。" />
            <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
              <Card bordered={false} className="shadow-sm" bodyStyle={{ padding: 20 }}>
                <div className="mb-4 text-base font-bold text-slate-950">会员结构</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {memberPlans.map((item) => (
                    <div key={item.name} className="rounded-xl border border-slate-100 p-4">
                      <div className="text-sm text-slate-500">{item.name}</div>
                      <div className="mt-3 text-3xl font-bold" style={{ color: item.color }}>
                        {formatNumber(item.value)}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
              <ChartPanel title="会员趋势" subtitle="专业版与旗舰版增长，是收入质量提升的关键">
                <div className="h-[320px]">
                  <ReactEcharts option={memberTrendOption} renderer="svg" />
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <SectionTitle index="09" title="邀请裂变" subtitle="邀请、注册、付费和裂变收入放在一起看，判断增长是否能自循环。" />
            <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
              <div className="grid gap-4 sm:grid-cols-2">
                {inviteMetrics.map((item) => (
                  <Card key={item.label} bordered={false} className="shadow-sm" bodyStyle={{ padding: 18 }}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm text-slate-500">{item.label}</div>
                        <div className="mt-3 text-3xl font-bold text-slate-950">{item.value}</div>
                      </div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-xl text-emerald-700 ring-1 ring-emerald-100">
                        {item.icon}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <ChartPanel title="裂变转化链路" subtitle="邀请人数到付费人数的转化路径">
                <div className="h-[320px]">
                  <ReactEcharts option={inviteOption} renderer="svg" />
                </div>
              </ChartPanel>
            </div>
          </section>

          <section>
            <SectionTitle index="10" title="排行榜" subtitle="老板最容易形成判断的列表：项目、用户、收入、邀请。" />
            <Card bordered={false} className="shadow-sm" bodyStyle={{ padding: 0 }}>
              <Tabs
                className="px-5 pt-3"
                items={Object.entries(rankingGroups).map(([key, group]) => ({
                  key,
                  label: group.label,
                  children: (
                    <Table
                      rowKey="key"
                      columns={rankingColumns}
                      dataSource={group.rows}
                      pagination={false}
                      size="small"
                      scroll={{ x: 720 }}
                    />
                  ),
                }))}
              />
            </Card>
          </section>
        </Spin>
      </div>
    </div>
  );
}
