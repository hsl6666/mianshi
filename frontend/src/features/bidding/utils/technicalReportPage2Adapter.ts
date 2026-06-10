export type Priority = "A" | "B" | "C";
export type IssueFeedback = "like" | "dislike";
export type IssueType = "删除类" | "修改类" | "增补类";

export interface DimensionRow {
  name: string;
  score: number;
  maxScore: number;
  strength: string;
  loss: string;
  action: string;
}

export interface IssueRow {
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
  feedback?: IssueFeedback;
  feedbackComment?: string;
}

export interface OptimizationRow {
  title: string;
  weakness: string;
  action: string;
  gain: string;
  priority: "高" | "中";
}

export interface ProjectInfoView {
  title: string;
  reportTitle: string;
  projectNo: string;
  renderDate: string;
  userName: string;
  userOrg: string;
  content: string;
  schedule: string;
  scoring: string;
}

export interface TechnicalReportPage2ViewModel {
  projectInfo: ProjectInfoView;
  dimensions: DimensionRow[];
  issues: IssueRow[];
  optimizations: OptimizationRow[];
  totalFullScore: number;
  totalSimulatedScore: number;
  dimensionSummary?: string;
  issuePrioritySummaries?: Partial<Record<Priority, string>>;
  feedbackSuggestion?: string;
  conclusion?: {
    main: string;
    suggestion: string;
  };
  nextSteps?: string[];
}

const defaultProjectInfo: ProjectInfoView = {
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

const defaultDimensions: DimensionRow[] = [
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

const defaultIssues: IssueRow[] = [
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

const defaultOptimizations: OptimizationRow[] = [
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

const defaultTotalFullScore = defaultDimensions.reduce((sum, row) => sum + row.maxScore, 0);
const defaultTotalSimulatedScore = defaultDimensions.reduce((sum, row) => sum + row.score, 0);

export const defaultTechnicalReportPage2ViewModel: TechnicalReportPage2ViewModel = {
  projectInfo: defaultProjectInfo,
  dimensions: defaultDimensions,
  issues: defaultIssues,
  optimizations: defaultOptimizations,
  totalFullScore: defaultTotalFullScore,
  totalSimulatedScore: defaultTotalSimulatedScore,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const text = asString(value);
    if (text.trim()) return text;
  }
  return "";
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function extractReportRoot(raw: unknown): Record<string, unknown> | null {
  const root = asRecord(raw);
  if (!root) return null;

  const reportData = asRecord(root.report_data);
  if (reportData) {
    const nestedReport = asRecord(reportData.report);
    if (nestedReport) return nestedReport;
    if (asRecord(reportData.project_intro)) return reportData;
    if (asRecord(reportData.project_info)) return reportData;
    return reportData;
  }

  const report = asRecord(root.report);
  if (report) return report;

  if (asRecord(root.project_intro) || asRecord(root.project_info)) return root;

  return null;
}

function mapIssuePriority(value: unknown): Priority {
  const text = asString(value);
  if (text.includes("高")) return "A";
  if (text.includes("低")) return "C";
  return "B";
}

function mapIssueType(value: unknown): IssueType {
  const text = asString(value);
  if (text.includes("删除")) return "删除类";
  if (text.includes("补充") || text.includes("增补")) return "增补类";
  return "修改类";
}

function mapIssueFeedback(value: unknown): IssueFeedback | undefined {
  const text = asString(value).toLowerCase();
  if (["like", "liked", "good", "positive", "up", "thumbs_up"].includes(text)) return "like";
  if (["dislike", "disliked", "bad", "negative", "down", "thumbs_down"].includes(text)) return "dislike";
  return undefined;
}

function mapOptimizationPriority(index: number, expectedImprovement: string): "高" | "中" {
  if (index < 2 || expectedImprovement.includes("3-") || expectedImprovement.includes("4分")) {
    return "高";
  }
  return "中";
}

function splitReportTitle(fullTitle: string, projectName: string): { title: string; reportTitle: string } {
  const normalizedProjectName = projectName.trim();
  const normalizedTitle = fullTitle.trim();

  if (!normalizedTitle) {
    return { title: normalizedProjectName, reportTitle: "技术标评审修稿报告" };
  }

  if (normalizedProjectName && normalizedTitle.startsWith(normalizedProjectName)) {
    const suffix = normalizedTitle.slice(normalizedProjectName.length).trim();
    return {
      title: normalizedProjectName,
      reportTitle: suffix || "技术标评审修稿报告",
    };
  }

  return {
    title: normalizedProjectName || normalizedTitle,
    reportTitle: normalizedProjectName ? normalizedTitle.replace(normalizedProjectName, "").trim() || "技术标评审修稿报告" : "技术标评审修稿报告",
  };
}

function mapProjectInfo(
  report: Record<string, unknown>,
  context?: Record<string, unknown> | null,
): ProjectInfoView {
  const projectIntro = asRecord(report.project_intro);
  const projectInfoLegacy = asRecord(report.project_info);
  const personalization = asRecord(report.personalization);
  const projectName = asString(
    projectIntro?.project_name ?? projectInfoLegacy?.project_name,
    defaultProjectInfo.title,
  );
  const fullTitle = asString(
    report.title ?? report.report_title,
    `${projectName}${defaultProjectInfo.reportTitle}`,
  );
  const { title, reportTitle } = splitReportTitle(fullTitle, projectName);

  const userName =
    firstNonEmpty(
      personalization?.user_name,
      context?.owner_display_name,
      context?.owner_username,
    ) || defaultProjectInfo.userName;
  const userOrg =
    firstNonEmpty(
      personalization?.user_unit,
      context?.company_name,
      projectInfoLegacy?.bidder_name,
    ) || defaultProjectInfo.userOrg;

  return {
    title,
    reportTitle,
    projectNo: asString(
      projectIntro?.tender_project_no ?? projectInfoLegacy?.project_no,
      defaultProjectInfo.projectNo,
    ),
    renderDate: asString(personalization?.rendered_date, defaultProjectInfo.renderDate),
    userName,
    userOrg,
    content: asString(
      projectIntro?.construction_content ?? projectInfoLegacy?.construction_scale,
      defaultProjectInfo.content,
    ),
    schedule: asString(
      projectIntro?.schedule_quality ?? projectInfoLegacy?.duration_quality,
      defaultProjectInfo.schedule,
    ),
    scoring: asString(
      projectIntro?.technical_scoring_overview ?? projectInfoLegacy?.bid_method,
      defaultProjectInfo.scoring,
    ),
  };
}

function mapDimensions(report: Record<string, unknown>): DimensionRow[] {
  const scoring = asRecord(report.scoring);
  const rows = Array.isArray(scoring?.rows) ? scoring.rows : [];

  const mapped = rows
    .map((row) => {
      const item = asRecord(row);
      if (!item || asString(item.domain) === "合计") return null;

      return {
        name: asString(item.domain),
        score: asNumber(item.simulated_score),
        maxScore: asNumber(item.full_score, 10),
        strength: asString(item.strengths),
        loss: asString(item.core_deductions),
        action: asString(item.supplement_adjustment_direction),
      };
    })
    .filter((item): item is DimensionRow => Boolean(item?.name));

  return mapped.length > 0 ? mapped : defaultDimensions;
}

function mapScoreTotals(
  report: Record<string, unknown>,
  dimensions: DimensionRow[],
): Pick<TechnicalReportPage2ViewModel, "totalFullScore" | "totalSimulatedScore"> {
  const scoring = asRecord(report.scoring);
  const scoreSummary = asRecord(report.score_summary);
  const summedScore = dimensions.reduce((sum, row) => sum + row.score, 0);
  const summedFull = dimensions.reduce((sum, row) => sum + row.maxScore, 0);

  return {
    totalFullScore: asNumber(
      scoring?.total_full_score ?? scoreSummary?.full_score,
      summedFull || defaultTotalFullScore,
    ),
    totalSimulatedScore: asNumber(
      scoring?.total_simulated_score ?? scoreSummary?.final_score,
      summedScore || defaultTotalSimulatedScore,
    ),
  };
}

function mapIssues(report: Record<string, unknown>): IssueRow[] {
  const rows = Array.isArray(report.issues) ? report.issues : [];

  const mapped = rows
    .map((row, index): IssueRow | null => {
      const item = asRecord(row);
      if (!item) return null;
      const feedback = mapIssueFeedback(
        item.feedback ?? item.feedback_status ?? item.feedbackStatus ?? item.user_feedback,
      );
      const explicitId =
        asString(item.number) || asString(item.id) || asString(item.issue_id);
      const title = asString(item.problem_title) || asString(item.title);
      const feedbackComment =
        asString(item.feedback_comment) || asString(item.feedbackComment);

      return {
        id: explicitId || String(index + 1).padStart(2, "0"),
        priority: mapIssuePriority(item.priority ?? item.severity),
        type: mapIssueType(item.revision_type),
        title,
        location: asString(item.location),
        problem: asString(item.issue) || asString(item.problem),
        logic: asString(item.judgement_logic) || asString(item.reason),
        suggestion: asString(item.fix_advice) || asString(item.suggestion),
        selfCheck: asString(item.self_check),
        ...(feedback ? { feedback } : {}),
        ...(feedbackComment ? { feedbackComment } : {}),
      };
    })
    .filter((item): item is IssueRow => Boolean(item?.title));

  return mapped.length > 0 ? mapped : defaultIssues;
}

function mapOptimizations(report: Record<string, unknown>): OptimizationRow[] {
  const guidance = asRecord(report.high_score_guidance);
  const rows = Array.isArray(guidance?.rows) ? guidance.rows : [];

  const mapped = rows
    .map((row, index) => {
      const item = asRecord(row);
      if (!item) return null;

      const gain = asString(item.expected_improvement);
      return {
        title: asString(item.direction),
        weakness: asString(item.current_gap),
        action: asString(item.recommendation),
        gain: gain || "+0.05分",
        priority: mapOptimizationPriority(index, gain),
      };
    })
    .filter((item): item is OptimizationRow => Boolean(item?.title));

  return mapped.length > 0 ? mapped.slice(0, 5) : defaultOptimizations;
}

function mapIssuePrioritySummaries(issues: IssueRow[]): Partial<Record<Priority, string>> | undefined {
  const grouped: Record<Priority, string[]> = { A: [], B: [], C: [] };

  issues.forEach((issue) => {
    grouped[issue.priority].push(issue.title);
  });

  const summaries: Partial<Record<Priority, string>> = {};
  (["A", "B", "C"] as Priority[]).forEach((priority) => {
    if (grouped[priority].length > 0) {
      summaries[priority] = grouped[priority].slice(0, 3).join("；");
    }
  });

  return Object.keys(summaries).length > 0 ? summaries : undefined;
}

function mapConclusion(report: Record<string, unknown>) {
  const scoring = asRecord(report.scoring);
  const summary = asRecord(scoring?.summary);
  const strengths = asString(summary?.strengths);
  const deductions = asString(summary?.core_deductions);
  const suggestion = asString(summary?.supplement_adjustment_direction);

  if (!strengths && !deductions && !suggestion) return undefined;

  return {
    main: [strengths, deductions].filter(Boolean).join(" "),
    suggestion: suggestion || defaultTechnicalReportPage2ViewModel.conclusion?.suggestion || "",
  };
}

function mapNextSteps(report: Record<string, unknown>, optimizations: OptimizationRow[]): string[] | undefined {
  const guidance = asRecord(report.high_score_guidance);
  const rows = Array.isArray(guidance?.rows) ? guidance.rows : [];
  const steps = rows
    .map((row) => asString(asRecord(row)?.recommendation))
    .filter(Boolean)
    .slice(0, 4);

  if (steps.length > 0) return steps;

  const fallback = optimizations.slice(0, 4).map((item) => item.action).filter(Boolean);
  return fallback.length > 0 ? fallback : undefined;
}

export function parseTechnicalReportPage2Data(raw: unknown): TechnicalReportPage2ViewModel | null {
  const root = asRecord(raw);
  const report = extractReportRoot(raw);
  if (!report) return null;

  const dimensions = mapDimensions(report);
  const issues = mapIssues(report);
  const optimizations = mapOptimizations(report);
  const scoreTotals = mapScoreTotals(report, dimensions);
  const scoring = asRecord(report.scoring);
  const summary = asRecord(scoring?.summary);

  return {
    projectInfo: mapProjectInfo(report, asRecord(root?.context)),
    dimensions,
    issues,
    optimizations,
    ...scoreTotals,
    dimensionSummary: asString(summary?.supplement_adjustment_direction) || undefined,
    issuePrioritySummaries: mapIssuePrioritySummaries(issues),
    feedbackSuggestion: asString(report.feedback_suggestion) || undefined,
    conclusion: mapConclusion(report),
    nextSteps: mapNextSteps(report, optimizations),
  };
}

export function buildTechnicalReportPage2ViewModel(raw?: unknown): TechnicalReportPage2ViewModel {
  return parseTechnicalReportPage2Data(raw) ?? defaultTechnicalReportPage2ViewModel;
}

/** 从优化项「预计提升」文案中解析单项提分（支持 +0.15分、1-2分、预计提升3-5分 等格式） */
export function parseOptimizationGain(gain?: string): number {
  if (!gain) return 0;

  const rangeMatch = gain.match(/提升\s*([\d.]+)\s*[-~～至]\s*([\d.]+)\s*分/);
  if (rangeMatch) {
    return (Number(rangeMatch[1]) + Number(rangeMatch[2])) / 2;
  }

  const singleMatch = gain.match(/提升\s*([\d.]+)\s*分/);
  if (singleMatch) {
    return Number(singleMatch[1]);
  }

  const prefixedRange = gain.match(/\+?\s*([\d.]+)\s*[-~～]\s*([\d.]+)\s*分/);
  if (prefixedRange) {
    return (Number(prefixedRange[1]) + Number(prefixedRange[2])) / 2;
  }

  const numbers = [...gain.matchAll(/(\d+(?:\.\d+)?)/g)].map((match) => Number(match[1]));
  if (numbers.length === 0) return 0;
  if (numbers.length === 1) return numbers[0];
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

export interface OptimizationGainRange {
  totalGain: number;
  incrementLow: number;
  incrementHigh: number;
}

/** 关键优化方向各项预计提分总计的 50%-80% 区间 */
export function calculateOptimizationGainRange(optimizations: OptimizationRow[]): OptimizationGainRange {
  const totalGain = optimizations.reduce((sum, item) => sum + parseOptimizationGain(item.gain), 0);
  return {
    totalGain,
    incrementLow: Number((totalGain * 0.5).toFixed(1)),
    incrementHigh: Number((totalGain * 0.8).toFixed(1)),
  };
}

export function formatGainIncrement(value: number): string {
  const formatted = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `+${formatted}`;
}

/** 入围参考线：百分制 86~87 分、五分制 4.3~4.4 分，对应得分率 86%~87% */
const QUALIFY_RATE_LOW = 0.86;
const QUALIFY_RATE_HIGH = 0.87;

function lerpRate(value: number, start: number, end: number, outStart: number, outEnd: number): number {
  if (value <= start) return outStart;
  if (value >= end) return outEnd;
  return outStart + ((value - start) / (end - start)) * (outEnd - outStart);
}

/**
 * 根据模拟得分与满分计算入围概率（5%~98%）。
 * 以得分率 86%~87% 为入围临界区：低于 80% 概率偏低，86%~87% 约 55%~72%，92% 以上趋近 90%+。
 */
export function calculateQualificationProbability(simulatedScore: number, fullScore: number): number {
  if (fullScore <= 0 || simulatedScore < 0) return 0;

  const rate = simulatedScore / fullScore;
  let probability: number;

  if (rate < 0.8) {
    probability = lerpRate(rate, 0.5, 0.8, 8, 35);
  } else if (rate < QUALIFY_RATE_LOW) {
    probability = lerpRate(rate, 0.8, QUALIFY_RATE_LOW, 35, 55);
  } else if (rate < QUALIFY_RATE_HIGH) {
    probability = lerpRate(rate, QUALIFY_RATE_LOW, QUALIFY_RATE_HIGH, 55, 72);
  } else if (rate < 0.92) {
    probability = lerpRate(rate, QUALIFY_RATE_HIGH, 0.92, 72, 90);
  } else {
    probability = lerpRate(Math.min(rate, 1), 0.92, 1, 90, 98);
  }

  return Math.round(Math.max(5, Math.min(98, probability)));
}

export interface ScoreTierDefinition {
  label: string;
  hint: string;
  rateMin: number;
  rateMax: number;
  badgeClassName: string;
}

/** 得分率梯级：入围临界区 86%~87%（百分制 86~87 分 / 五分制 4.3~4.35 分） */
export const SCORE_TIER_DEFINITIONS: ScoreTierDefinition[] = [
  {
    label: "较差",
    hint: "竞争力不足",
    rateMin: 0,
    rateMax: 0.65,
    badgeClassName: "bg-red-50 text-red-700",
  },
  {
    label: "一般",
    hint: "基础偏弱",
    rateMin: 0.65,
    rateMax: 0.75,
    badgeClassName: "bg-orange-50 text-orange-700",
  },
  {
    label: "中等",
    hint: "中等水平",
    rateMin: 0.75,
    rateMax: 0.8,
    badgeClassName: "bg-amber-50 text-amber-700",
  },
  {
    label: "待提升",
    hint: "未达入围线",
    rateMin: 0.8,
    rateMax: QUALIFY_RATE_LOW,
    badgeClassName: "bg-slate-100 text-slate-600",
  },
  {
    label: "良好",
    hint: "入围临界区",
    rateMin: QUALIFY_RATE_LOW,
    rateMax: QUALIFY_RATE_HIGH,
    badgeClassName: "bg-[#e0f2f1] text-[#0d7a6f]",
  },
  {
    label: "良好偏上",
    hint: "入围较稳",
    rateMin: QUALIFY_RATE_HIGH,
    rateMax: 0.92,
    badgeClassName: "bg-teal-50 text-teal-700",
  },
  {
    label: "优秀",
    hint: "表现突出",
    rateMin: 0.92,
    rateMax: 0.96,
    badgeClassName: "bg-emerald-50 text-emerald-700",
  },
  {
    label: "优秀（顶尖）",
    hint: "顶尖水平",
    rateMin: 0.96,
    rateMax: 1.001,
    badgeClassName: "bg-green-50 text-green-800",
  },
];

export interface ResolvedScoreTier {
  tier: ScoreTierDefinition;
  scoreRangeText: string;
  rate: number;
}

function formatTierBoundary(score: number, fullScore: number): string {
  const clamped = Math.max(0, Math.min(score, fullScore));
  if (fullScore <= 10) {
    const rounded = Math.round(clamped * 100) / 100;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/(\.\d)0$/, "$1");
  }
  return String(Math.round(clamped));
}

export function resolveScoreTier(simulatedScore: number, fullScore: number): ResolvedScoreTier {
  const rate = fullScore > 0 ? simulatedScore / fullScore : 0;
  const tier =
    SCORE_TIER_DEFINITIONS.find((item) => rate >= item.rateMin && rate < item.rateMax) ??
    SCORE_TIER_DEFINITIONS[SCORE_TIER_DEFINITIONS.length - 1];

  const rangeHigh = tier.rateMax > 1 ? fullScore : tier.rateMax * fullScore;
  const scoreRangeText = `${formatTierBoundary(tier.rateMin * fullScore, fullScore)} - ${formatTierBoundary(rangeHigh, fullScore)}分`;

  return { tier, scoreRangeText, rate };
}

export interface RankingEstimate {
  text: string;
  hint: string;
  topPercent: number;
}

function resolveRankingHint(topPercent: number): string {
  if (topPercent <= 12) return "领先梯队";
  if (topPercent <= 22) return "竞争力强";
  if (topPercent <= 38) return "中上位置";
  if (topPercent <= 52) return "中游偏上";
  if (topPercent <= 68) return "中游位置";
  return "靠后位置";
}

/**
 * 根据模拟得分与满分估算排名（前 X%，数值越小排名越靠前）。
 * 与入围参考线对齐：86%~87% 约前 38%~42%，92% 以上约前 22% 以内，96% 以上约前 12% 以内。
 */
export function calculateRankingEstimate(simulatedScore: number, fullScore: number): RankingEstimate {
  if (fullScore <= 0 || simulatedScore < 0) {
    return { text: "—", hint: "暂无参考", topPercent: 100 };
  }

  const rate = simulatedScore / fullScore;
  let topPercent: number;

  if (rate < 0.65) {
    topPercent = lerpRate(rate, 0.5, 0.65, 88, 72);
  } else if (rate < 0.75) {
    topPercent = lerpRate(rate, 0.65, 0.75, 72, 58);
  } else if (rate < 0.8) {
    topPercent = lerpRate(rate, 0.75, 0.8, 58, 50);
  } else if (rate < QUALIFY_RATE_LOW) {
    topPercent = lerpRate(rate, 0.8, QUALIFY_RATE_LOW, 50, 42);
  } else if (rate < QUALIFY_RATE_HIGH) {
    topPercent = lerpRate(rate, QUALIFY_RATE_LOW, QUALIFY_RATE_HIGH, 42, 38);
  } else if (rate < 0.92) {
    topPercent = lerpRate(rate, QUALIFY_RATE_HIGH, 0.92, 38, 22);
  } else if (rate < 0.96) {
    topPercent = lerpRate(rate, 0.92, 0.96, 22, 12);
  } else {
    topPercent = lerpRate(Math.min(rate, 1), 0.96, 1, 12, 5);
  }

  const roundedTopPercent = Math.round(Math.max(5, Math.min(90, topPercent)));

  return {
    text: `前${roundedTopPercent}%`,
    hint: resolveRankingHint(roundedTopPercent),
    topPercent: roundedTopPercent,
  };
}
