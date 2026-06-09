import { useMemo, useState } from "react";
import { Button, Card, Empty, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeftOutlined, FileSearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { formatChinaTime } from "@/utils/date";
import { ROUTE_PATHS } from "@/constants/common";
import type {
  TechnicalReportDimensionScore,
  TechnicalReportIssue,
  TechnicalReviewReportData,
  TechnicalReviewReportOut,
} from "../types";

const sampleReportData: TechnicalReviewReportData = {
  "report_title": "技术文件AI模拟评审报告",
  "subtitle": "项目背景、评分依据、AI模拟得分、问题修复与补充建议",
  "project_info": {
    "project_name": "长丰县岗集农批市场建设项目土方清表工程",
    "project_no": "2026ACCGZ50060",
    "bidder_name": "安徽派辰建设工程有限公司",
    "review_date": "2026-06-04",
    "construction_scale": "主要涉及清表、渣土外运、大门及围挡、监控摄像等，具体详见招标文件、图纸、工程量清单及答疑。",
    "construction_location": "安徽省合肥市长丰县岗集镇",
    "contract_estimate": "3213355.48元",
    "duration_quality": "计划工期60日历天；质量标准：合格。",
    "bid_method": "技术评分合理价格法",
    "technical_full_score": "施工组织设计100分"
  },
  "score_summary": {
    "final_score": 86,
    "full_score": 100,
    "rating": "良好偏上",
    "score_range": "84-88",
    "confidence": "中高",
    "submit_advice": "建议完成关键逻辑、目录识别和合规复核后提交"
  },
  "dimension_scores": [
    {
      "name": "评分项覆盖度",
      "score": 14,
      "max_score": 15,
      "comment": "招标文件列明的工程概况、主要施工方法、物资计划、机械设备计划、劳动力安排、质量、安全、工期、文明施工、施工总平面布置图等10项内容均有对应章节。"
    },
    {
      "name": "AI识别友好度",
      "score": 8,
      "max_score": 10,
      "comment": "设置了评分索引表，章节与评审因素基本对应；但目录前部仅显示页码数字，缺少完整目录条目，不利于AI和评委快速定位。"
    },
    {
      "name": "专业性密度",
      "score": 11,
      "max_score": 12,
      "comment": "清表、渣土外运、围挡、大门、监控、雨季施工等内容专业性较强，包含设备、工艺、检测和管理要求。"
    },
    {
      "name": "数字量化程度",
      "score": 9,
      "max_score": 10,
      "comment": "工期、工程量、设备数量、劳动力、检测频次、扬尘噪声控制等量化较充分，少数数据来源和现场复核依据仍需强化。"
    },
    {
      "name": "项目特征响应度",
      "score": 10,
      "max_score": 12,
      "comment": "对岗集镇、土方清表、渣土外运、雨季、临近村庄等特征有响应；部分道路、管线、工程量和现场参数需确认是否来自图纸清单或踏勘资料。"
    },
    {
      "name": "措施可执行性",
      "score": 11,
      "max_score": 12,
      "comment": "多数措施明确责任人、时间节点、设备投入和检查要求，具备较强执行性。"
    },
    {
      "name": "风险应对完整度",
      "score": 8,
      "max_score": 10,
      "comment": "雨季、机械、渣土运输、围挡坍塌、高温等风险均有应对措施，但建议补充风险清单、触发条件、响应分级、责任人和复盘闭环表。"
    },
    {
      "name": "逻辑一致性",
      "score": 6,
      "max_score": 8,
      "comment": "总体工期和质量目标一致，但正文中出现“第26天至第12至28天”等时间表述错误，可能影响进度逻辑可信度。"
    },
    {
      "name": "图表证据支撑度",
      "score": 6,
      "max_score": 7,
      "comment": "包含机械设备表、检测仪器表、劳动力计划表、进度网络图、施工总平面布置图和临时用地表，图表较完整；部分图片标题与工程内容关联需复核。"
    },
    {
      "name": "合规与格式安全",
      "score": 3,
      "max_score": 4,
      "comment": "技术文件显示至第50页，基本贴合招标文件建议不超过50页；封面出现投标单位名称，虽未在文件中明确识别暗标要求，仍建议人工复核电子投标系统技术文件身份信息规则。"
    }
  ],
  "issues": [
    {
      "title": "正文存在关键进度时间表述错误",
      "priority": "A",
      "severity": "high",
      "location": "第二章主要施工方法，第一节施工总思路",
      "problem": "文件写明“以渣土消纳及处置第26天至第12至28天为关键节点”，同一句内出现第26天与第12至28天并列，时间逻辑明显不清。",
      "reason": "招标文件技术评审重点包含确保工期的技术组织措施，关键线路和资源组织若出现时间矛盾，会降低评委和AI对进度计划可执行性的判断。",
      "suggestion": "核对进度网络图和横道图，将该句统一改为明确的起止节点，例如“第12天至第28天”或“第26天至第37天”，并同步检查清表、开挖、外运、回填各章节中的节点表述是否一致。",
      "expected_score_gain": "预计提升1-2分",
      "related_dimensions": [
        "逻辑一致性",
        "措施可执行性",
        "AI识别友好度"
      ]
    },
    {
      "title": "技术文件封面出现投标单位名称需合规复核",
      "priority": "A",
      "severity": "high",
      "location": "封面",
      "problem": "技术文件封面显示“安徽派辰建设工程有限公司”。招标文件检索中未明确识别暗标要求，但技术文件身份信息是否允许出现在施工组织设计中仍需结合电子投标系统和招标文件格式人工复核。",
      "reason": "若本项目技术文件或系统提交窗口存在暗标、匿名评审或不得出现投标人识别信息的要求，该项可能形成重大合规风险。",
      "suggestion": "逐项核对招标文件第八章投标文件格式、电子投标制作软件提示及交易系统技术文件上传要求；若按暗标提交，应删除封面单位名称、企业标识、人员社保归属等可识别投标人的信息，并统一替换为非识别性表述。",
      "expected_score_gain": "主要降低否决或扣分风险",
      "related_dimensions": [
        "合规与格式安全"
      ]
    },
    {
      "title": "目录页识别效果较弱",
      "priority": "B",
      "severity": "medium",
      "location": "目录",
      "problem": "目录区域前部连续显示页码数字，未同步显示完整章节标题，后续虽设置评分索引表，但正式目录可读性不足。",
      "reason": "招标文件明确启用合肥公共资源交易大模型AI“类人”评审功能辅助评标，目录结构混乱会影响机器识别和评委快速定位。",
      "suggestion": "重生成目录，保留“章节标题+页码”的完整格式，并确保目录、评分索引表、正文标题、页码四者一致；建议在目录后保留评分索引表，专门对应招标文件10项评审因素。",
      "expected_score_gain": "预计提升1-2分",
      "related_dimensions": [
        "AI识别友好度",
        "评分项覆盖度"
      ]
    },
    {
      "title": "部分现场参数需补充依据或改为复核口径",
      "priority": "B",
      "severity": "medium",
      "location": "第一章工程概况、现场踏勘分析、项目规模与总体要求",
      "problem": "文件列明表土厚度、承载力、地下水位、通信管群长度、清表面积、渣土外运量、围挡长度等大量具体数据，但部分内容未在已识别招标摘要中直接对应。",
      "reason": "高量化表达有利于得分，但若数据与图纸、清单或现场踏勘资料不一致，可能被认为依据不足或存在编制风险。",
      "suggestion": "对每个关键工程量和现场参数增加来源标注，如“依据工程量清单”“依据图纸”“依据现场踏勘记录”；无法确认的数据统一调整为“经图纸、清单及现场复核后确定”，避免绝对化承诺。",
      "expected_score_gain": "预计提升1-2分",
      "related_dimensions": [
        "数字量化程度",
        "项目特征响应度",
        "逻辑一致性"
      ]
    },
    {
      "title": "风险管理可进一步表格化闭环",
      "priority": "B",
      "severity": "medium",
      "location": "第七章确保安全生产的技术组织措施、第八章确保工期的技术组织措施",
      "problem": "文件已包含强降雨、机械伤害、渣土运输、围挡坍塌、高温中暑等应急内容，但风险识别、触发条件、责任人、响应时限、资源配置、恢复验收和复盘改进尚未形成统一闭环表。",
      "reason": "风险应对是AI评审和人工评审容易区分高分文件的部分，只有措施描述而缺少闭环表，会削弱可执行性和证据化表达。",
      "suggestion": "新增“项目主要风险识别与闭环处置表”，字段包括风险事项、发生原因、影响后果、预警指标、触发阈值、责任岗位、应急资源、处置时限、恢复验收标准、复盘资料归档。",
      "expected_score_gain": "预计提升1-3分",
      "related_dimensions": [
        "风险应对完整度",
        "措施可执行性",
        "图表证据支撑度"
      ]
    },
    {
      "title": "部分图片和图注需核对工程相关性",
      "priority": "C",
      "severity": "low",
      "location": "第一章工程概况、第二章主要施工方法、第十章施工总平面布置图及附图",
      "problem": "文件使用多张现场、设备、作业和管理图片，部分图注如“钢筋加工区”等与土方清表、大门围挡、监控摄像工程的核心内容关联度不强。",
      "reason": "招标文件要求结合工程实际特点编制，图片若偏通用或与本项目清单内容不匹配，会削弱项目特征响应度和图表证据支撑度。",
      "suggestion": "保留项目总平面、进度网络图、施工总平面布置图、机械设备表等关键证据；替换或删除与本工程无直接关系的图片，图注统一改为“本项目适用场景+对应措施+管理目标”。",
      "expected_score_gain": "预计提升0.5-1.5分",
      "related_dimensions": [
        "项目特征响应度",
        "图表证据支撑度",
        "专业性密度"
      ]
    }
  ],
  "priority_tasks": {
    "A": [
      "修正“第26天至第12至28天”等进度时间矛盾，统一正文、横道图、网络图和资源计划。",
      "人工复核技术文件是否存在暗标或身份信息限制；如需匿名评审，删除封面单位名称和其他可识别信息。"
    ],
    "B": [
      "重生成完整目录，确保目录、评分索引表、正文标题和页码一致。",
      "对工程量、现场参数、管线条件、消纳路线等具体数据补充来源或改为复核口径。",
      "新增风险识别与闭环处置表，补足触发条件、责任岗位、响应时限和复盘归档。"
    ],
    "C": [
      "优化图片和图注，删除与土方清表工程关联不强的通用图片。",
      "在评分索引表中增加“对应招标评审因素”列，进一步提升AI识别友好度。",
      "补充资源计划与进度节点对应表，强化机械、劳动力和关键线路的匹配关系。"
    ]
  },
  "score_gain_forecast": {
    "finish_A": "预计提升2-4分，并显著降低合规与逻辑风险",
    "finish_AB": "预计提升4-7分，修订后可达到88-91分区间",
    "finish_ABC": "预计提升5-8分，具备冲击90分以上的基础",
    "expected_after_revision": "88-91分"
  },
  "review_suggestion": "该技术文件对招标文件施工组织设计10项评审内容覆盖较完整，项目特征、工期、机械、劳动力、质量安全文明措施和附表附图均有较充分响应，整体具备良好偏上的技术得分基础。提交前应优先修正进度逻辑错误，复核技术文件身份信息合规要求，并整理目录和评分索引；随后补强风险闭环表、参数依据和图片相关性，以提升AI辅助评审识别稳定性和人工评审可信度。",
  "disclaimer": "本报告为AI模拟预评审结果，仅用于技术文件质量自查和修改参考，不代表正式评标结论。最终评审结果以评标委员会及正式评审系统为准。"
};

const severityMap: Record<TechnicalReportIssue["severity"], { label: string; color: string; border: string }> = {
  high: { label: "高", color: "red", border: "border-l-red-600" },
  medium: { label: "中", color: "gold", border: "border-l-amber-500" },
  low: { label: "低", color: "green", border: "border-l-emerald-600" },
};

function text(value: unknown, fallback = "未识别") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function normalizeReport(value: unknown): TechnicalReviewReportOut {
  const maybeWrapped = value as Partial<TechnicalReviewReportOut>;
  const reportData = maybeWrapped.report_data ?? (value as TechnicalReviewReportData);
  if (!reportData || typeof reportData !== "object") {
    throw new Error("JSON 必须是报告对象或包含 report_data 的接口返回对象");
  }
  const data = reportData as TechnicalReviewReportData;
  if (!data.project_info?.project_name || data.score_summary?.final_score === undefined) {
    throw new Error("JSON 缺少 project_info.project_name 或 score_summary.final_score");
  }
  return {
    attachment_id: maybeWrapped.attachment_id ?? 0,
    report_uploaded_at: maybeWrapped.report_uploaded_at ?? new Date().toISOString(),
    report_data: data,
  };
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography.Title level={4} className="!mt-8 !mb-4 !border-l-8 !border-l-teal-700 !pl-4 !text-teal-700">
      {children}
    </Typography.Title>
  );
}

export default function TechnicalReportPage() {
  const navigate = useNavigate();
  const [report, setReport] = useState<TechnicalReviewReportOut>(() => ({
    attachment_id: 0,
    report_uploaded_at: new Date().toISOString(),
    report_data: sampleReportData,
  }));
  const [jsonOpen, setJsonOpen] = useState(false);
  const [jsonText, setJsonText] = useState(() => JSON.stringify(sampleReportData, null, 2));

  const data = report.report_data;
  const project = data.project_info;
  const summary = data.score_summary;

  const dimensionColumns = useMemo<ColumnsType<TechnicalReportDimensionScore>>(
    () => [
      { title: "评分维度", dataIndex: "name", width: 180 },
      { title: "得分", dataIndex: "score", width: 90, align: "center" },
      { title: "满分", dataIndex: "max_score", width: 90, align: "center" },
      { title: "评语", dataIndex: "comment" },
    ],
    [],
  );

  const handleApplyJson = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const next = normalizeReport(parsed);
      setReport(next);
      setJsonOpen(false);
      message.success("报告 JSON 已应用");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "JSON 格式不正确");
    }
  };

  return (
    <div className="min-h-full bg-slate-50 pb-10">
      <div className="sticky top-14 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:top-16">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(ROUTE_PATHS.biddingProjects)}>
              返回项目管理
            </Button>
            <Typography.Text strong>技术评审报告预览</Typography.Text>
          </Space>
          <Button type="primary" icon={<FileSearchOutlined />} onClick={() => setJsonOpen(true)}>
            填入 JSON
          </Button>
        </div>
      </div>

      <main className="mx-auto max-w-[1120px] px-4 py-6">
        {!data || !project || !summary ? (
          <Card>
            <Empty description="暂无报告数据" />
          </Card>
        ) : (
          <Card bodyStyle={{ padding: 0 }} className="overflow-hidden">
            <div className="bg-slate-50 px-4 py-6 md:px-12 md:py-10">
              <Typography.Title level={2} className="!mb-2 !text-center !text-teal-700">
                {text(project.project_name)} - {text(data.report_title, "技术文件AI模拟评审报告")}
              </Typography.Title>
              <Typography.Paragraph className="!mb-1 !text-center !text-base !text-slate-500">
                {text(data.subtitle, "项目背景、评分依据、AI模拟得分、问题修复与补充建议")}
              </Typography.Paragraph>
              <div className="mb-8 text-center text-sm leading-7 text-slate-600">
                评审对象：{text(project.bidder_name)} ｜ 评审日期：{text(project.review_date)} ｜ 项目编号：
                {text(project.project_no)}
                {report.report_uploaded_at && (
                  <div>数据时间：{formatChinaTime(report.report_uploaded_at, "YYYY-MM-DD HH:mm:ss")}</div>
                )}
              </div>

              <SectionTitle>一、项目基本信息</SectionTitle>
              <table className="w-full border-collapse bg-white shadow-sm">
                <tbody>
                  {[
                    ["建设规模", project.construction_scale],
                    ["建设地点", project.construction_location],
                    ["合同估算价", project.contract_estimate],
                    ["工期与质量", project.duration_quality],
                    ["评标办法", project.bid_method],
                    ["技术文件满分", project.technical_full_score],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <th className="w-44 border border-slate-200 bg-teal-50 p-3 text-left font-semibold text-teal-700">
                        {label}
                      </th>
                      <td className="border border-slate-200 bg-white p-3 leading-7">{text(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <SectionTitle>二、AI模拟评审得分</SectionTitle>
              <div className="grid gap-5 border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[240px_1fr]">
                <div>
                  <div className="text-4xl font-bold text-orange-700">
                    {text(summary.final_score, "0")} / {text(summary.full_score, "100")}
                  </div>
                  <div className="mt-2 text-slate-500">AI模拟评审得分</div>
                </div>
                <div className="grid gap-2 leading-7">
                  <div><strong>评级：</strong>{text(summary.rating)}</div>
                  <div><strong>评分区间：</strong>{text(summary.score_range)}</div>
                  <div><strong>置信度：</strong>{text(summary.confidence)}</div>
                  <div><strong>提交建议：</strong>{text(summary.submit_advice)}</div>
                </div>
              </div>

              <SectionTitle>三、十大维度评分表</SectionTitle>
              <Table
                rowKey={(row) => row.name}
                columns={dimensionColumns}
                dataSource={data.dimension_scores}
                pagination={false}
                size="middle"
                bordered
              />

              <SectionTitle>四、问题修复与建议清单</SectionTitle>
              <div className="space-y-4">
                {data.issues.length === 0 && <Empty description="暂无问题清单" />}
                {data.issues.map((issue) => {
                  const severity = severityMap[issue.severity] ?? severityMap.medium;
                  return (
                    <article
                      key={`${issue.priority}-${issue.title}`}
                      className={`border border-l-4 border-slate-200 ${severity.border} bg-white p-5 shadow-sm`}
                    >
                      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                        <Typography.Title level={5} className="!mb-0">
                          {issue.title}
                        </Typography.Title>
                        <div className="flex gap-2">
                          <Tag color="cyan">{issue.priority}类</Tag>
                          <Tag color={severity.color}>风险{severity.label}</Tag>
                        </div>
                      </div>
                      {[
                        ["定位", issue.location],
                        ["问题", issue.problem],
                        ["扣分原因", issue.reason],
                        ["修改建议", issue.suggestion],
                        ["预计提分", issue.expected_score_gain],
                      ].map(([label, value]) => (
                        <p key={label} className="mb-2 leading-7">
                          <strong>{label}：</strong>{text(value)}
                        </p>
                      ))}
                      {issue.related_dimensions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {issue.related_dimensions.map((dimension) => (
                            <Tag key={dimension}>{dimension}</Tag>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>

              <SectionTitle>五、优先级修改任务</SectionTitle>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  ["A", "A类：必须修改"],
                  ["B", "B类：建议修改"],
                  ["C", "C类：冲高分优化"],
                ].map(([key, label]) => {
                  const tasks = data.priority_tasks[key as "A" | "B" | "C"] ?? [];
                  return (
                    <div key={key} className="border border-slate-200 bg-white p-4 shadow-sm">
                      <Typography.Title level={5} className="!mt-0 !text-teal-700">
                        {label}
                      </Typography.Title>
                      <ul className="mb-0 pl-5 leading-7">
                        {(tasks.length ? tasks : ["暂无明确任务。"]).map((task) => (
                          <li key={task}>{task}</li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <SectionTitle>六、预计提分空间</SectionTitle>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  ["完成A类问题", data.score_gain_forecast.finish_A],
                  ["完成A+B类问题", data.score_gain_forecast.finish_AB],
                  ["完成A+B+C类问题", data.score_gain_forecast.finish_ABC],
                  ["预计可提升至", data.score_gain_forecast.expected_after_revision],
                ].map(([label, value]) => (
                  <div key={label} className="border border-slate-200 bg-white p-4 shadow-sm">
                    <strong className="mb-2 block text-teal-700">{label}</strong>
                    <div>{text(value)}</div>
                  </div>
                ))}
              </div>

              <SectionTitle>七、复评建议</SectionTitle>
              <div className="border border-slate-200 bg-white p-5 text-base leading-8 shadow-sm">
                {text(data.review_suggestion)}
              </div>

              <div className="mt-8 border border-orange-200 bg-orange-50 p-4 leading-7 text-orange-900">
                {text(data.disclaimer, "本报告为AI模拟预评审结果，仅用于技术文件质量自查和修改参考，不代表正式评标结论。")}
              </div>
            </div>
          </Card>
        )}
      </main>

      <Modal
        title="填入报告 JSON"
        open={jsonOpen}
        onCancel={() => setJsonOpen(false)}
        onOk={handleApplyJson}
        okText="渲染报告"
        cancelText="取消"
        width={860}
      >
        <Input.TextArea
          value={jsonText}
          onChange={(event) => setJsonText(event.target.value)}
          autoSize={{ minRows: 16, maxRows: 24 }}
          spellCheck={false}
          className="font-mono"
          placeholder="粘贴接口返回的 report_data，或包含 report_data 的完整响应 JSON"
        />
      </Modal>
    </div>
  );
}
