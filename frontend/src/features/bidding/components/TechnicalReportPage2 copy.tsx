import { useMemo, useRef, useState } from "react";
import { Button, Card, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircleOutlined, DownloadOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { ReactEcharts } from "@/components/ReactEcharts";

type Priority = "A" | "B" | "C";
type IssueType = "删除类" | "修改类" | "增补类";

interface DimensionRow {
  name: string;
  score: number;
  maxScore: number;
  strength: string;
  loss: string;
  action: string;
}

interface IssueRow {
  id: string;
  priority: Priority;
  type: IssueType;
  title: string;
  location: string;
  problem: string;
  logic: string;
  suggestion: string;
  selfCheck: string;
  gain?: string;
}

interface OptimizationRow {
  title: string;
  weakness: string;
  action: string;
  gain: string;
  priority: "高" | "中";
}

const projectInfo = {
  title: "长丰县庄墓镇徐岗村农产品仓储中心项目",
  reportTitle: "技术标评审修稿报告",
  projectNo: "2026ACCGZ50056",
  renderDate: "2026-05-27",
  userName: "需补充",
  userOrg: "需补充",
  content:
    "新建一栋仓储中心、一栋附属用房，并配套一体式消防泵站及高位消防水箱；仓储中心占地1253平方米、一层轻钢结构、建筑面积1266平方米、内设500立方冷库；附属用房占地125平方米、一层框架结构、建筑面积125平方米。",
  schedule: "计划工期90日历天，计划开工日期为2026年06月10日，质量标准为合格。",
  scoring:
    "技术文件详细评审仅设“施工组织设计”1项，满分100分；评分关注工程概况、主要施工方法、主要物资计划、主要机械设备计划、劳动力安排、质量、安全、工期、文明施工、施工总平面布置图，并启用合肥公共资源交易大模型AI“类人”评审辅助复核。",
};

const dimensions: DimensionRow[] = [
  {
    name: "工程概况",
    score: 8.8,
    maxScore: 10,
    strength: "项目名称、编号、地点、工期、质量标准及核心建设内容提取准确。",
    loss: "现场参数来源链未在同一位置同步标明，页眉页脚残留旧项目名。",
    action: "补充本项目关键响应索引，并标注图纸、清单、踏勘、答疑来源边界。",
  },
  {
    name: "主要施工方法",
    score: 8.5,
    maxScore: 10,
    strength: "土建、安装、室外、绿色施工、智慧工地等方法链条完整。",
    loss: "混入与本项目无关的光伏系统施工方案，个别参数过度具体。",
    action: "删去项目外内容，锚定仓储中心、冷库、附属用房和消防泵站四条主线。",
  },
  {
    name: "主要物资计划",
    score: 8.6,
    maxScore: 10,
    strength: "材料进场、验收、绿色建材、余料回收和危废处置闭环较完整。",
    loss: "绿色建材认证、报关单、碳足迹等表述过细，来源补证不足。",
    action: "整理为进场计划、验收清单、复检流程、台账留痕四层结构。",
  },
  {
    name: "机械设备计划",
    score: 8.4,
    maxScore: 10,
    strength: "土方、吊装、混凝土、冷库施工、检测等设备类型较齐全。",
    loss: "设备参数、投用时间和施工节点对应关系不够直观。",
    action: "改成“工序-设备-进场时点-责任人-备用方案”五列式。",
  },
  {
    name: "劳动力安排",
    score: 8.4,
    maxScore: 10,
    strength: "劳动力保障、岗位配备、实名制、工资专户和培训管理均有响应。",
    loss: "仍出现工资、费用、清单等商务化表述，技术文件边界不够干净。",
    action: "删减商务结算词，补充分阶段动态调配曲线或岗位表。",
  },
  {
    name: "质量组织措施",
    score: 8.6,
    maxScore: 10,
    strength: "质量体系、三检一验、样板引路、信息化巡检链条较完整。",
    loss: "部分标准编号和极限参数写得较满，可信度依赖逐项核验。",
    action: "改成“依据-控制点-验收人-记录物”四步法，并统一核验关键标准。",
  },
  {
    name: "安全组织措施",
    score: 8.2,
    maxScore: 10,
    strength: "危大工程识别、专项方案、消防、吊装、高处作业和应急预案已覆盖。",
    loss: "“零死亡”“100%有效率”等绝对化目标偏满格。",
    action: "改为过程控制指标，增加触发条件、旁站、验收和复核闭环。",
  },
  {
    name: "工期组织措施",
    score: 8.5,
    maxScore: 10,
    strength: "施工节奏、关键线路、动态纠偏和应急工期保障均有展开。",
    loss: "节点和资源投入之间的映射还不够显性。",
    action: "改成“节点-工序-资源-纠偏阈值-替代方案”的闭环表。",
  },
  {
    name: "文明施工措施",
    score: 8.4,
    maxScore: 10,
    strength: "扬尘、噪声、垃圾、围挡、冲洗和智慧监管内容齐全。",
    loss: "部分百分比和实时达标表述偏绝对，监测、告知和审批边界不足。",
    action: "改成“措施-监测-留痕-反馈-整改”结构，并和属地要求对齐。",
  },
  {
    name: "总平面布置图",
    score: 8.2,
    maxScore: 10,
    strength: "办公区、生活区、材料堆放区、加工区、道路和应急区均已考虑。",
    loss: "文字说明较多，但作业流线、消防通道与居民通行关系不够直观。",
    action: "增加图例、分区编号、车辆路径和消防通道说明。",
  },
];

const issues: IssueRow[] = [
  {
    id: "01",
    priority: "A",
    type: "删除类",
    title: "页眉页脚残留旧项目名称",
    location: "投标技术文件第1页，页眉/页脚；招标文件PDF第62-63页、69页。",
    problem: "跨项目残留会直接削弱首屏可信度，也会让专家怀疑整份技术文件存在模板套用痕迹。",
    logic: "旧项目名称与本项目无关，是明显项目外残留，属于应优先清理的格式和内容问题。",
    suggestion: "统一替换页眉页脚中的旧项目名称、单位名称和任何前项目痕迹，只保留本项目准确名称和必要页码信息。",
    selfCheck: "检查封面、页眉、页脚、目录页和正文首屏是否全部统一为本项目名称。",
    gain: "+0.10 ~ 0.15分",
  },
  {
    id: "02",
    priority: "A",
    type: "删除类",
    title: "出现与招标范围无关的光伏系统施工方案",
    location: "投标技术文件第11-12页，第二章第三/四节相关表格。",
    problem: "典型项目外内容，容易被认定为套用其他工程资料，影响技术文件的针对性和真实性。",
    logic: "该内容无法与本项目招标范围建立合理关系，应按项目外内容处理。",
    suggestion: "删除光伏系统整段内容，并替换为围绕仓储中心、冷库、消防泵站和附属用房的施工方法说明。",
    selfCheck: "删除后检查第二章是否仍完整覆盖本项目实际施工对象，且没有引入新的项目外系统。",
    gain: "+0.10 ~ 0.15分",
  },
  {
    id: "03",
    priority: "B",
    type: "修改类",
    title: "绝对化承诺过多，表达偏满格",
    location: "投标技术文件第8页、第16页、第30页、第34-43页，多处重复出现。",
    problem: "专家会更关注承诺强度而不是实施路径，容易被扣可行性和严谨性分。",
    logic: "并非招标明令禁止，但技术标应以过程控制和履约机制为主。",
    suggestion: "把绝对化表达改为风险降低、过程监测、节点验收、闭环整改和责任到人的过程控制语言。",
    selfCheck: "删除或弱化明显口号化、结果化的绝对承诺，只保留可执行管理动作。",
    gain: "+0.05 ~ 0.08分",
  },
  {
    id: "04",
    priority: "B",
    type: "增补类",
    title: "现场踏勘信息较具体，但来源链不够统一",
    location: "投标技术文件第5页、第8页、第13页、第18页等现场踏勘分析及相关章节。",
    problem: "内容与项目场景相关，但没有来源说明时，会被看作“有据但不完整”的补充信息。",
    logic: "现场补充信息可保留；重点补来源说明、范围关系和开工前复核边界。",
    suggestion: "在相关段落末尾统一补充“来源于图纸/踏勘/清单/交底，开工前复核”等说明。",
    selfCheck: "逐条检查具体信息是否都能说明来源，且没有写成不可复核的绝对事实。",
    gain: "+0.05 ~ 0.08分",
  },
  {
    id: "05",
    priority: "B",
    type: "修改类",
    title: "智慧工地和云端/AI表述偏强",
    location: "投标技术文件第16页、第30页、第36页、第43页相关段落。",
    problem: "如果没有授权、接口、网络条件和替代方案，表述会从加分点变成可行性风险点。",
    logic: "智慧工地本身不违规，但需要说明能不能接、谁来接、断网怎么办、数据如何留痕。",
    suggestion: "补充平台授权、接口条件、网络条件、替代方案和数据留痕方式，把强承诺改成具备条件时采用。",
    selfCheck: "所有智慧工地、AI识别、云同步表述均应配有条件说明和替代路径。",
    gain: "+0.05 ~ 0.08分",
  },
  {
    id: "06",
    priority: "B",
    type: "修改类",
    title: "部分关键标准和设备参数需要再核验",
    location: "投标技术文件第9-14页、第16页、第20-23页、第29-33页。",
    problem: "方向总体正确，但若没有图纸、清单、答疑或专业方案支撑，证据链不稳。",
    logic: "不是“没有依据就一定错误”，而是需要把参数放回图纸、清单、规范或踏勘证据链里。",
    suggestion: "关键参数逐项对表到图纸、清单、答疑或专项方案；无法即刻核验的参数保留人工复核口径。",
    selfCheck: "对标准编号、设备规格、极限参数逐条复核，不确定处先留核验标识。",
  },
  {
    id: "07",
    priority: "C",
    type: "修改类",
    title: "总平面与图表说明还可以更强",
    location: "投标技术文件第44-52页，第十章及附表四至六。",
    problem: "属于高分表达不足；补文字化说明后，AI和专家都更容易快速抓住亮点。",
    logic: "不构成否决，也不属于硬性违规，但会影响首轮印象和高分档呈现。",
    suggestion: "给总平面图、进度图和关键附表补短注释，突出路径、分区、消防、通行和应急逻辑。",
    selfCheck: "图表都应能被一句话解释清楚，并且能被目录和页码快速检索到。",
    gain: "+0.05 ~ 0.10分",
  },
];

const optimizations: OptimizationRow[] = [
  {
    title: "清理旧项目痕迹和项目外内容",
    weakness: "统一页面页脚和项目名称，删除与本项目无关内容",
    action: "统一项目名称，删除无关光伏段落，重新锚定仓储中心、冷库、附属用房和消防泵站。",
    gain: "+0.15分",
    priority: "高",
  },
  {
    title: "增加评分索引和来源说明",
    weakness: "增加评分响应索引，补充信息来源链",
    action: "在目录后增加半页施工组织设计评分响应索引，把10个评分维度逐条对应到章节和页码。",
    gain: "+0.10分",
    priority: "高",
  },
  {
    title: "优化安全生产措施表达",
    weakness: "将绝对化承诺改为过程控制和闭环机制",
    action: "改写为风险识别、过程控制、节点验收和闭环纠偏，保留目标但弱化绝对结果承诺。",
    gain: "+0.08分",
    priority: "中",
  },
  {
    title: "强化图表说明和总平面图表达",
    weakness: "为图表和总平面图增加文字化说明",
    action: "每张核心图下补80至150字说明，写明关键线路、分区施工、消防通道、居民通行和应急路径。",
    gain: "+0.08分",
    priority: "中",
  },
  {
    title: "核验关键参数和标准依据",
    weakness: "对关键参数和标准进行核验，请保证证据链完整",
    action: "关键参数逐项对表到图纸、清单、答疑或专项方案；无法即刻核验的参数保留人工复核口径。",
    gain: "+0.05分",
    priority: "中",
  },
];

const optimizationIconColors = ["#4ade80", "#4ade80", "#14b8a6", "#64748b", "#64748b"];

const totalScore = dimensions.reduce((sum, row) => sum + row.score, 0);
const issueSummary = {
  A: issues.filter((issue) => issue.priority === "A").length,
  B: issues.filter((issue) => issue.priority === "B").length,
  C: issues.filter((issue) => issue.priority === "C").length,
};

const priorityMeta: Record<Priority, { label: string; color: string; className: string; softClassName: string }> = {
  A: {
    label: "A类 必须修改",
    color: "red",
    className: "border-red-200 bg-red-50",
    softClassName: "text-red-600 bg-red-50",
  },
  B: {
    label: "B类 建议修改",
    color: "orange",
    className: "border-orange-200 bg-orange-50",
    softClassName: "text-orange-600 bg-orange-50",
  },
  C: {
    label: "C类 优化提升",
    color: "green",
    className: "border-emerald-200 bg-emerald-50",
    softClassName: "text-emerald-700 bg-emerald-50",
  },
};

function ModuleSectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-3">
        <span className="inline-block h-6 w-1.5 shrink-0 rounded-sm bg-[#0d7a6f]" />
        <Typography.Title level={3} className="!mb-0 !text-lg !font-bold !text-[#0d7a6f] md:!text-xl">
          {title}
        </Typography.Title>
      </div>
      {subtitle && <p className="mb-0 mt-2 pl-[18px] text-sm leading-6 text-slate-500">{subtitle}</p>}
    </div>
  );
}

function OverviewMetric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="text-center">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-2 text-2xl font-bold text-[#00a870]">{value}</div>
      <div className="mt-1 text-xs text-slate-400">{hint}</div>
    </div>
  );
}

function OverviewStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "red" | "orange" }) {
  const valueClass =
    tone === "red" ? "text-[#f53f3f]" : tone === "orange" ? "text-[#f59e0b]" : "text-slate-800";
  return (
    <div className="text-center">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-bold ${valueClass}`}>{value}</div>
    </div>
  );
}

const reportKeywords = [
  "项目介绍",
  "模拟打分",
  "核心丢分点",
  "亮点",
  "补充方向",
  "冲高分方向",
  "问题清单",
] as const;

function ReportHeaderPanel() {
  const metaItems = [
    ["用户名称", projectInfo.userName],
    ["用户单位", projectInfo.userOrg],
    ["渲染日期", projectInfo.renderDate],
  ] as const;

  return (
    <section className="border-b border-teal-100/60 bg-gradient-to-b from-white to-[#f0fdfa]">
      <div className="mx-auto max-w-[1180px] px-4 py-8 text-center md:py-10">
        <span className="mb-5 inline-flex items-center rounded-full bg-[#e0f2f1] px-4 py-1.5 text-xs font-medium tracking-wide text-[#0d7a6f]">
          AI 模拟评审 · 修稿建议
        </span>

        <Typography.Title
          level={2}
          className="!mb-0 !text-xl !font-bold !leading-snug !text-slate-900 md:!text-2xl lg:!text-[26px]"
        >
          {projectInfo.title}
          <span className="text-[#0d7a6f]">{projectInfo.reportTitle}</span>
        </Typography.Title>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {reportKeywords.map((keyword) => (
            <span
              key={keyword}
              className="rounded-full border border-teal-100 bg-white/70 px-3 py-1 text-xs text-slate-600"
            >
              {keyword}
            </span>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {metaItems.map(([label, value]) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm shadow-sm ring-1 ring-slate-100"
            >
              <span className="text-slate-400">{label}：</span>
              <span className="font-medium text-slate-700">{value}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function ProjectIntroPanel() {
  const rows = [
    ["项目名称", projectInfo.title],
    ["招标编号/项目编号", projectInfo.projectNo],
    ["建设内容", projectInfo.content],
    ["工期/质量", projectInfo.schedule],
    ["技术标评分概况", projectInfo.scoring],
  ] as const;

  return (
    <section className="mb-8">
      <ModuleSectionTitle title="一、项目介绍" />
      <div className="overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label} className="border-t border-slate-100 first:border-t-0">
                <th className="w-[168px] border-r border-slate-100 bg-[#f0fdfa] px-5 py-4 text-left align-top text-sm font-semibold leading-7 text-[#0d7a6f] md:w-[200px]">
                  {label}
                </th>
                <td className="px-5 py-4 align-top text-sm leading-7 text-slate-700">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function TechnicalReportPage2() {
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const displayScore = Number(totalScore.toFixed(1));
  const scoreRangeLow = Math.floor(totalScore - 1.6);
  const scoreRangeHigh = Math.ceil(totalScore + 2.4);
  const optimizedLow = (displayScore + 3).toFixed(1);
  const optimizedHigh = (displayScore + 5).toFixed(1);

  const handleDownloadReport = async () => {
    if (!reportRef.current || downloading) return;

    setDownloading(true);
    try {
      const html2canvas = (await import("html2canvas")).default;

      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });

      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#f7fbfa",
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        windowWidth: reportRef.current.scrollWidth,
        windowHeight: reportRef.current.scrollHeight,
      });

      const fileName = `${projectInfo.title}${projectInfo.reportTitle}.png`.replace(/[\\/:*?"<>|]/g, "-");
      const link = document.createElement("a");
      link.download = fileName;
      link.href = canvas.toDataURL("image/png", 1);
      link.click();
    } catch (error) {
      console.error(error);
      message.error("报告图片生成失败，请稍后重试");
    } finally {
      setDownloading(false);
    }
  };

  const scoreGaugeOption = useMemo(
    () => ({
      animation: false,
      series: [
        {
          type: "gauge",
          min: 0,
          max: 100,
          startAngle: 90,
          endAngle: -270,
          radius: "82%",
          center: ["50%", "48%"],
          progress: {
            show: true,
            roundCap: false,
            width: 14,
            itemStyle: {
              color: {
                type: "linear",
                x: 0,
                y: 0,
                x2: 1,
                y2: 1,
                colorStops: [
                  { offset: 0, color: "#7dd3c0" },
                  { offset: 1, color: "#0d7a6f" },
                ],
              },
            },
          },
          axisLine: {
            lineStyle: {
              width: 14,
              color: [[1, "#e8eef2"]],
            },
          },
          pointer: { show: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          detail: {
            valueAnimation: false,
            formatter: (value: number) => `{score|${value.toFixed(1)}}\n{unit|/100}`,
            rich: {
              score: { color: "#ff7d00", fontSize: 42, fontWeight: 800, lineHeight: 48 },
              unit: { color: "#94a3b8", fontSize: 16, fontWeight: 700, lineHeight: 22 },
            },
            offsetCenter: [0, "10%"],
          },
          data: [{ value: displayScore }],
        },
      ],
    }),
    [displayScore],
  );

  const radarOption = useMemo(
    () => ({
      animation: false,
      color: ["#0f9f8f", "#94a3b8"],
      tooltip: { trigger: "item" },
      legend: {
        top: 0,
        right: 4,
        itemWidth: 14,
        itemHeight: 8,
        textStyle: { color: "#64748b" },
      },
      radar: {
        radius: "68%",
        center: ["50%", "55%"],
        indicator: dimensions.map((item) => ({
          name: `${item.name}\n${item.score.toFixed(1)}/${item.maxScore.toFixed(0)}`,
          max: item.maxScore,
        })),
        splitNumber: 5,
        axisName: {
          color: "#334155",
          fontSize: 11,
          lineHeight: 17,
          formatter: (value: string) => {
            const [name, score] = value.split("\n");
            return `{name|${name}}\n{score|${score}}`;
          },
          rich: {
            name: { color: "#334155", fontSize: 11, fontWeight: 600, lineHeight: 17 },
            score: { color: "#0f9f8f", fontSize: 11, fontWeight: 700, lineHeight: 17 },
          },
        },
        splitLine: { lineStyle: { color: "#dbe7e5" } },
        splitArea: { areaStyle: { color: ["#ffffff", "#f0fdfa"] } },
        axisLine: { lineStyle: { color: "#cbd5e1" } },
      },
      series: [
        {
          name: "评分",
          type: "radar",
          data: [
            {
              name: "得分",
              value: dimensions.map((item) => item.score),
              areaStyle: { color: "rgba(15, 159, 143, 0.22)" },
              lineStyle: { width: 2 },
              symbolSize: 5,
            },
            {
              name: "行业平均参考",
              value: [8.2, 8.1, 8.0, 7.9, 8.0, 8.2, 7.9, 8.1, 8.0, 7.8],
              areaStyle: { color: "rgba(148, 163, 184, 0.08)" },
              lineStyle: { width: 1.5, type: "dashed" },
              symbolSize: 0,
            },
          ],
        },
      ],
    }),
    [],
  );

  const issuePieOption = useMemo(
    () => ({
      animation: false,
      color: ["#ef4444", "#f59e0b", "#10b981"],
      tooltip: { trigger: "item" },
      series: [
        {
          type: "pie",
          radius: ["58%", "78%"],
          center: ["50%", "50%"],
          avoidLabelOverlap: true,
          label: { formatter: "{b}\\n{c}项", color: "#334155" },
          data: [
            { name: "A类", value: issueSummary.A },
            { name: "B类", value: issueSummary.B },
            { name: "C类", value: issueSummary.C },
          ],
        },
      ],
    }),
    [],
  );

  const issueTypeOption = useMemo(
    () => ({
      animation: false,
      color: ["#0f9f8f"],
      grid: { left: 72, right: 24, top: 16, bottom: 18 },
      xAxis: {
        type: "value",
        max: 4,
        splitLine: { lineStyle: { color: "#eef2f7" } },
        axisLabel: { color: "#64748b" },
      },
      yAxis: {
        type: "category",
        data: ["删除类", "修改类", "增补类"],
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: "#334155" },
      },
      tooltip: { trigger: "axis" },
      series: [
        {
          type: "bar",
          barWidth: 16,
          data: [
            { value: issues.filter((item) => item.type === "删除类").length, itemStyle: { color: "#ef4444" } },
            { value: issues.filter((item) => item.type === "修改类").length, itemStyle: { color: "#f59e0b" } },
            { value: issues.filter((item) => item.type === "增补类").length, itemStyle: { color: "#10b981" } },
          ],
          label: { show: true, position: "right", formatter: "{c}项", color: "#475569" },
        },
      ],
    }),
    [],
  );

  const scoreFunnelOption = useMemo(
    () => ({
      animation: false,
      series: [
        {
          type: "funnel",
          left: "6%",
          top: 12,
          bottom: 12,
          width: "88%",
          minSize: "42%",
          maxSize: "100%",
          sort: "descending",
          gap: 6,
          label: {
            show: true,
            position: "inside",
            color: "#fff",
            fontSize: 14,
            lineHeight: 22,
            formatter: (params: { dataIndex: number }) => {
              const lines = [
                `当前得分\n${displayScore}分`,
                "完成A类问题\n+1.5 - 2.5分",
                "完成A+B类问题\n+3 - 5分",
                `冲击优秀线\n${optimizedLow} - ${optimizedHigh}分`,
              ];
              return lines[params.dataIndex] ?? "";
            },
          },
          labelLine: { show: false },
          itemStyle: { borderColor: "#fff", borderWidth: 2, borderRadius: 10 },
          data: [
            { value: 100, itemStyle: { color: "#4db6ac", borderRadius: 10 } },
            { value: 90, itemStyle: { color: "#66bb6a", borderRadius: 10 } },
            { value: 80, itemStyle: { color: "#ffb74d", borderRadius: 10 } },
            { value: 70, itemStyle: { color: "#ff8a65", borderRadius: 10 } },
          ],
        },
      ],
    }),
    [displayScore, optimizedLow, optimizedHigh],
  );

  const scoreTrendOption = useMemo(
    () => ({
      animation: false,
      grid: { left: 4, right: 4, top: 16, bottom: 4 },
      xAxis: {
        type: "category",
        boundaryGap: false,
        show: false,
        data: ["", "", ""],
      },
      yAxis: {
        type: "value",
        show: false,
        min: displayScore - 1,
        max: displayScore + 6,
      },
      tooltip: { show: false },
      series: [
        {
          type: "line",
          smooth: true,
          symbol: "circle",
          symbolSize: 7,
          itemStyle: { color: "#14b8a6", borderColor: "#fff", borderWidth: 2 },
          lineStyle: { color: "#14b8a6", width: 2.5 },
          areaStyle: {
            color: {
              type: "linear",
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: "rgba(20, 184, 166, 0.28)" },
                { offset: 1, color: "rgba(20, 184, 166, 0.02)" },
              ],
            },
          },
          data: [displayScore, displayScore + 1.8, displayScore + 3.8],
        },
      ],
    }),
    [displayScore],
  );

  const dimensionColumns = useMemo<ColumnsType<DimensionRow>>(
    () => [
      {
        title: "维度",
        dataIndex: "name",
        width: 160,
        fixed: "left",
        render: (value) => <span className="font-semibold text-slate-800">{value}</span>,
      },
      { title: "写得好的地方", dataIndex: "strength", width: 320 },
      { title: "核心丢分点", dataIndex: "loss", width: 320 },
      { title: "需要补充/调整方向", dataIndex: "action", width: 360 },
    ],
    [],
  );

  return (
    <div className="min-h-full bg-[#f7fbfa] text-slate-800">
      <div className="sticky top-0 z-20 border-b border-teal-100/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1180px] justify-end px-4 py-3">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={handleDownloadReport}
          >
            下载报告
          </Button>
        </div>
      </div>

      <div ref={reportRef} className="bg-[#f7fbfa] pb-12">
        <ReportHeaderPanel />

        <main className="mx-auto max-w-[1180px] px-4 py-6 md:py-8">
          <ProjectIntroPanel />

        <section className="mb-8">
          <ModuleSectionTitle title="二、综合评分概览" />
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_280px]">
            <div className="flex flex-col items-center justify-center rounded-lg border border-slate-100 bg-white px-4 py-6 shadow-sm">
              <div className="h-48 w-full">
                <ReactEcharts option={scoreGaugeOption} renderer="svg" />
              </div>
              <span className="mt-3 inline-flex rounded-full bg-[#e0f2f1] px-8 py-2 text-sm font-bold text-[#0d7a6f]">
                良好（偏上）
              </span>
            </div>

            <div className="flex flex-col rounded-lg border border-slate-100 bg-white shadow-sm">
              <div className="grid grid-cols-3 gap-4 px-6 py-6">
                <OverviewMetric label="得分区间" value={`${scoreRangeLow} - ${scoreRangeHigh}分`} hint="评审区间参考" />
                <OverviewMetric label="入围概率" value="82%" hint="预测概率" />
                <OverviewMetric label="排名预估" value="前30%" hint="同类项目参考" />
              </div>
              <div className="border-t border-slate-100" />
              <div className="grid grid-cols-5 gap-2 px-4 py-5">
                <OverviewStat label="评审维度" value={`${dimensions.length}项`} />
                <OverviewStat label="核心问题" value={`${issues.length}项`} />
                <OverviewStat label="A类问题" value={`${issueSummary.A}项`} tone="red" />
                <OverviewStat label="B类问题" value={`${issueSummary.B}项`} tone="red" />
                <OverviewStat label="C类问题" value={`${issueSummary.C}项`} tone="orange" />
              </div>
            </div>

            <div className="flex flex-col rounded-lg border border-slate-100 bg-white px-5 py-5 shadow-sm">
              <div className="text-center">
                <div className="text-sm text-slate-500">预计可提升</div>
                <div className="mt-1 text-3xl font-bold text-[#f53f3f]">+3 ~ +5分</div>
                <div className="mt-1 text-xs text-slate-400">通过修改建议可提升</div>
              </div>
              <div className="mt-3 h-28">
                <ReactEcharts option={scoreTrendOption} renderer="svg" />
              </div>
              <div className="mt-2 flex items-end justify-between text-center">
                <div>
                  <div className="text-xs text-slate-400">当前分数</div>
                  <div className="mt-1 text-lg font-bold text-[#00a870]">{displayScore}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">优化后预估</div>
                  <div className="mt-1 text-lg font-bold text-[#00a870]">
                    {optimizedLow} - {optimizedHigh}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <ModuleSectionTitle title="三、评分维度分析" subtitle="用雷达图和明细表同时呈现 10 个维度的强弱项。" />
          <div className="grid gap-4 lg:grid-cols-[420px_minmax(0,1fr)]">
            <Card className="min-w-0 overflow-hidden shadow-sm" bodyStyle={{ padding: 18 }}>
              <div className="h-[380px]">
                <ReactEcharts option={radarOption} renderer="svg" />
              </div>
            </Card>
            <Card className="min-w-0 overflow-hidden shadow-sm" bodyStyle={{ padding: 0 }}>
              <Table
                rowKey="name"
                columns={dimensionColumns}
                dataSource={dimensions}
                pagination={false}
                scroll={{ x: 1160, y: 380 }}
                size="small"
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <strong>分析结论</strong>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1} colSpan={3}>
                        技术文件已覆盖全部评分维度，先清理硬伤，再补索引、来源说明和图表文字化说明。
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </Card>
          </div>
        </section>

        <section className="mb-8">
          <ModuleSectionTitle title="四、问题概览" subtitle="问题按优先级和类型拆分，A类问题优先处理，B类问题负责稳定高分可信度。" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="shadow-sm" bodyStyle={{ padding: 18 }}>
              <div className="mb-2 text-base font-semibold text-slate-900">问题等级分布</div>
              <div className="grid items-center gap-4 md:grid-cols-[220px_1fr]">
                <div className="h-56">
                  <ReactEcharts option={issuePieOption} renderer="svg" />
                </div>
                <div className="space-y-3">
                  {(["A", "B", "C"] as Priority[]).map((key) => (
                    <div key={key} className={`rounded border p-3 ${priorityMeta[key].className}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold">{priorityMeta[key].label}</span>
                        <span className="text-lg font-bold">{issueSummary[key]}项</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
            <Card className="shadow-sm" bodyStyle={{ padding: 18 }}>
              <div className="mb-2 text-base font-semibold text-slate-900">问题类型分布</div>
              <div className="h-72">
                <ReactEcharts option={issueTypeOption} renderer="svg" />
              </div>
            </Card>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded border border-red-100 bg-red-50 p-5">
              <div className="mb-2 font-semibold text-red-700">A类 必须修改（2项）</div>
              <p className="mb-0 text-sm leading-7 text-red-800">页眉页脚旧项目名、光伏系统施工方案属于首屏可信度和项目针对性的硬伤。</p>
            </div>
            <div className="rounded border border-orange-100 bg-orange-50 p-5">
              <div className="mb-2 font-semibold text-orange-700">B类 建议修改（4项）</div>
              <p className="mb-0 text-sm leading-7 text-orange-800">重点解决绝对化承诺、现场来源链、智慧工地条件和关键参数核验。</p>
            </div>
            <div className="rounded border border-emerald-100 bg-emerald-50 p-5">
              <div className="mb-2 font-semibold text-emerald-700">C类 优化提升（1项）</div>
              <p className="mb-0 text-sm leading-7 text-emerald-800">总平面和图表补短注释，增强专家速读和机器检索命中率。</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <ModuleSectionTitle title="五、核心问题清单（按优先级）" subtitle="每个问题都保留 PDF 报告中的定位、判断逻辑、修复建议和改完自查。" />
          <div className="space-y-4">
            {issues.map((issue) => {
              const meta = priorityMeta[issue.priority];
              return (
                <article key={issue.id} className={`rounded border bg-white p-5 shadow-sm ${meta.className}`}>
                  <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                    <div>
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className={`rounded px-2 py-1 text-xs font-bold ${meta.softClassName}`}>{issue.id}</span>
                        <Tag color={meta.color}>{meta.label}</Tag>
                        <Tag>{issue.type}</Tag>
                        <Typography.Title level={5} className="!mb-0 !text-slate-900">
                          {issue.title}
                        </Typography.Title>
                      </div>
                      <div className="grid gap-2 text-sm leading-7 text-slate-700">
                        <p className="mb-0">
                          <strong>定位：</strong>
                          {issue.location}
                        </p>
                        <p className="mb-0">
                          <strong>问题：</strong>
                          {issue.problem}
                        </p>
                        <p className="mb-0">
                          <strong>判断逻辑：</strong>
                          {issue.logic}
                        </p>
                        <p className="mb-0">
                          <strong>修复建议：</strong>
                          {issue.suggestion}
                        </p>
                        <p className="mb-0">
                          <strong>改完自查：</strong>
                          {issue.selfCheck}
                        </p>
                      </div>
                    </div>
                    <aside className="rounded border border-white/80 bg-white/80 p-4">
                      <div className="text-sm text-slate-500">预计贡献</div>
                      <div className="mt-2 text-2xl font-bold text-teal-700">{issue.gain ?? "稳分项"}</div>
                      <div className="mt-4 text-sm text-slate-500">处理策略</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Tag color={meta.color}>{issue.priority}类优先</Tag>
                        <Tag>{issue.type}</Tag>
                      </div>
                    </aside>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <ModuleSectionTitle title="六、修改建议与提分空间" subtitle="按 PDF 报告的“如何冲优秀高分”部分整理为 Top 5 执行动作。" />
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm lg:grid lg:grid-cols-2">
            <div className="border-b border-slate-100 p-6 lg:border-b-0 lg:border-r">
              <div className="mb-4 text-base font-semibold text-[#0d7a6f]">提分空间预测</div>
              <div className="h-[300px]">
                <ReactEcharts option={scoreFunnelOption} renderer="svg" />
              </div>
              <p className="mb-0 text-xs text-slate-400">注：实际得分以最终评审为准</p>
            </div>

            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">关键优化方向 (Top 5)</div>
                <div className="flex gap-8 text-sm text-slate-400">
                  <span>预期提升</span>
                  <span className="w-8 text-center">优先级</span>
                </div>
              </div>
              <div className="divide-y divide-slate-100">
                {optimizations.map((item, index) => (
                  <div key={item.title} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 first:pt-0 last:pb-0">
                    <span
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                      style={{ backgroundColor: optimizationIconColors[index] }}
                    >
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{item.title}</div>
                      <p className="mb-0 mt-1 text-sm leading-6 text-slate-400">{item.weakness}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-8">
                      <span className="w-16 text-right font-semibold text-[#00897b]">{item.gain}</span>
                      <span
                        className={`w-8 text-center font-medium ${item.priority === "高" ? "text-[#d0021b]" : "text-[#f5a623]"}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <ModuleSectionTitle title="七、评审结论与下一步" subtitle="先处理明显硬伤，再做结构化补强，最后统一口径。" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <ExclamationCircleOutlined className="text-orange-600" />
                综合结论
              </div>
              <p className="mb-4 text-sm leading-7 text-slate-700">
                技术文件覆盖了招标文件列明的全部技术评分维度，仓储中心、冷库、消防泵站、施工方法、资源配置和履约管理主线比较完整。
                当前限制优秀档的主要因素，是页眉页脚旧项目残留、光伏系统等项目外内容、部分绝对化承诺以及具体参数来源链不够稳。
              </p>
              <div className="rounded border border-teal-100 bg-teal-50 p-4 text-sm leading-7 text-teal-900">
                建议先清理项目外内容和旧项目痕迹，再补评分索引、来源说明和图表文字化说明，最后统一标准编号、设备参数和技术路线口径。
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <CheckCircleOutlined className="text-teal-700" />
                下一步行动
              </div>
              <ol className="mb-0 space-y-3 pl-0">
                {[
                  "立即删除旧项目名、页眉页脚残留和光伏系统施工方案。",
                  "补齐施工组织设计评分响应索引，建立评分点到章节页码的映射。",
                  "对现场踏勘、关键标准、设备参数、智慧工地表述增加来源链和条件边界。",
                  "给总平面图、进度图、关键附表增加 80-150 字文字化说明。",
                ].map((item, index) => (
                  <li key={item} className="flex gap-3 text-sm leading-7 text-slate-700">
                    <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-700 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <p className="mt-6 mb-0 text-center text-xs leading-6 text-slate-400">
            免责声明：本报告由 AI 生成，仅供参考，不构成任何法律或商业建议，最终评审结果以招标方评审为准。
          </p>
        </section>
        </main>
      </div>
    </div>
  );
}
