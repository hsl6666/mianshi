import { Alert, Descriptions, Empty, Tag, Typography } from "antd";
import { resolveAssetUrl } from "../../api";
import { riskConfig } from "../constants";
import type { InterviewResultDetail } from "../../types";
import { Score } from "./Metric";

export function TalentReport({ detail }: { detail: InterviewResultDetail }) {
  const { summary, report, score_breakdown: scores } = detail;
  const risk = riskConfig[summary.risk_level];
  return (
    <div className="space-y-5">
      <Alert type={summary.risk_level === "high" ? "warning" : "success"} showIcon title={report.conclusion} description={report.overall_comment} />
      <section className="rounded-lg border border-stone-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <Typography.Title level={4} className="!mb-1">
              {summary.name}
            </Typography.Title>
            <p className="text-sm text-stone-500">{summary.role}</p>
          </div>
          <Tag color={risk.color}>{risk.label}</Tag>
        </div>
        <Descriptions column={2} size="small" className="mt-4">
          <Descriptions.Item label="手机号">{summary.phone || "未填写"}</Descriptions.Item>
          <Descriptions.Item label="邮箱">{summary.email || "未填写"}</Descriptions.Item>
          <Descriptions.Item label="附件">{summary.attachments_count}</Descriptions.Item>
          <Descriptions.Item label="口试录音">{summary.recordings_count || 0}</Descriptions.Item>
        </Descriptions>
      </section>
      <section className="grid gap-3 sm:grid-cols-4">
        <Score label="综合" value={scores.total_score} />
        <Score label="资料" value={scores.profile_score} />
        <Score label="笔试" value={scores.written_score} />
        <Score label="口试" value={scores.oral_score} />
      </section>
      <section className="rounded-lg border border-stone-200 p-5">
        <h3 className="mb-3 font-semibold">口试记录</h3>
        {report.qa_pairs.length ? (
          <div className="space-y-3">
            {report.qa_pairs.map((item, index) => (
              <div key={`${item.at}-${index}`} className="rounded-lg bg-stone-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Question {index + 1}</div>
                <p className="mt-2 text-sm leading-6 text-stone-900">{item.question}</p>
                {item.audio_url ? <audio controls src={resolveAssetUrl(item.audio_url)} className="mt-3 w-full" /> : <p className="mt-3 text-sm">{item.answer}</p>}
              </div>
            ))}
          </div>
        ) : (
          <Empty description="暂无口试记录" />
        )}
      </section>
    </div>
  );
}
