import { Drawer, Empty, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { formatChinaTime } from "@/utils/date";
import type {
  TechnicalReportDimensionScore,
  TechnicalReportIssue,
  TechnicalReviewReportOut,
} from "../types";

interface TechnicalReportDrawerProps {
  open: boolean;
  loading?: boolean;
  report: TechnicalReviewReportOut | null;
  onClose: () => void;
}

const severityMap: Record<TechnicalReportIssue["severity"], { label: string; color: string; border: string }> = {
  high: { label: "高", color: "red", border: "border-l-red-600" },
  medium: { label: "中", color: "gold", border: "border-l-amber-500" },
  low: { label: "低", color: "green", border: "border-l-emerald-600" },
};

function text(value: unknown, fallback = "未识别") {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
}

function SectionTitle({ children }: { children: string }) {
  return (
    <Typography.Title level={4} className="!mt-8 !mb-4 !border-l-8 !border-l-teal-700 !pl-4 !text-teal-700">
      {children}
    </Typography.Title>
  );
}

export default function TechnicalReportDrawer({ open, loading, report, onClose }: TechnicalReportDrawerProps) {
  const data = report?.report_data;
  const project = data?.project_info;
  const summary = data?.score_summary;

  const dimensionColumns: ColumnsType<TechnicalReportDimensionScore> = [
    { title: "评分维度", dataIndex: "name", width: 180 },
    { title: "得分", dataIndex: "score", width: 90, align: "center" },
    { title: "满分", dataIndex: "max_score", width: 90, align: "center" },
    { title: "评语", dataIndex: "comment" },
  ];

  return (
    <Drawer
      title="查看技术评审报告"
      open={open}
      onClose={onClose}
      width="min(1080px, 100vw)"
      destroyOnClose
      loading={loading}
    >
      {!data || !project || !summary ? (
        <Empty description="暂无报告数据" />
      ) : (
        <div className="min-h-full bg-slate-50 px-3 py-2 md:px-8 md:py-6">
          <div className="mx-auto max-w-[980px]">
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
                <div>上传时间：{formatChinaTime(report.report_uploaded_at, "YYYY-MM-DD HH:mm:ss")}</div>
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
              {(data.issues.length ? data.issues : []).map((issue) => {
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
              {data.issues.length === 0 && <Empty description="暂无问题清单" />}
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
        </div>
      )}
    </Drawer>
  );
}
