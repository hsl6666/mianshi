import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, Input, Modal, Spin, Table, Tag, Tooltip, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckCircleOutlined, DislikeOutlined, DownloadOutlined, ExclamationCircleOutlined, LikeOutlined } from "@ant-design/icons";
import { useSearchParams } from "react-router-dom";
import { ReactEcharts } from "@/components/ReactEcharts";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import {
  fetchPublicBidVersionReportDataRaw,
  updatePublicBidVersionIssueFeedback,
  updatePublicBidVersionReportFeedback,
} from "../api";
import {
  fetchPublicReportFeedbackTags,
  groupReportFeedbackTags,
} from "@/api/reportFeedback";
import {
  buildTechnicalReportPage2ViewModel,
  calculateOptimizationGainRange,
  calculateQualificationProbability,
  calculateRankingEstimate,
  defaultTechnicalReportPage2ViewModel,
  formatGainIncrement,
  resolveScoreTier,
  type DimensionRow,
  type IssueFeedback,
  type IssueRow,
  type Priority,
  type ProjectInfoView,
  type TechnicalReportPage2ViewModel,
} from "../utils/technicalReportPage2Adapter";
import {
  mergeUrlContextIntoViewModel,
  parseTechnicalReport2UrlContext,
} from "../utils/technicalReport2Url";

const optimizationIconColors = ["#4ade80", "#4ade80", "#14b8a6", "#64748b", "#64748b"];

const ISSUE_FEEDBACK_PLACEHOLDERS: Record<IssueFeedback, string> = {
  like: "请说明好在哪里，例如：定位准确、建议可执行、判断逻辑清晰…",
  dislike: "请说明不足的地方在哪里，例如：定位不清、建议过于笼统、与实际情况不符…",
};

const DEFAULT_ISSUE_FEEDBACK_TAGS: Record<IssueFeedback, string[]> = {
  like: ["定位准确", "建议可执行", "判断逻辑清晰", "贴合项目实际", "表述专业"],
  dislike: ["定位不清", "建议过于笼统", "与实际情况不符", "缺少依据来源", "判断逻辑有偏差"],
};

interface IssueFeedbackDraft {
  issueId: string;
  feedback: IssueFeedback;
  selectedTags: string[];
  comment: string;
}

function buildFeedbackComment(selectedTags: string[], comment: string) {
  return [...selectedTags, comment.trim()].filter(Boolean).join("；");
}

function splitFeedbackComment(
  feedback: IssueFeedback,
  raw: string,
  tagOptions: Record<IssueFeedback, string[]>,
) {
  const knownTags = tagOptions[feedback];
  const parts = raw.split(/[；，,]/).map((part) => part.trim()).filter(Boolean);
  const selectedTags: string[] = [];
  const freeTextParts: string[] = [];

  parts.forEach((part) => {
    if (knownTags.includes(part) && !selectedTags.includes(part)) {
      selectedTags.push(part);
      return;
    }
    freeTextParts.push(part);
  });

  return {
    selectedTags,
    comment: freeTextParts.join("；"),
  };
}

function getFeedbackDraftLength(draft: IssueFeedbackDraft) {
  return buildFeedbackComment(draft.selectedTags, draft.comment).length;
}

const defaultIssuePrioritySummaries = {
  A: "页眉页脚旧项目名、光伏系统施工方案属于首屏可信度和项目针对性的硬伤。",
  B: "重点解决绝对化承诺、现场来源链、智慧工地条件和关键参数核验。",
  C: "总平面和图表补短注释，增强专家速读和机器检索命中率。",
} as const;

const defaultConclusion = {
  main: "技术文件覆盖了招标文件列明的全部技术评分维度，仓储中心、冷库、消防泵站、施工方法、资源配置和履约管理主线比较完整。当前限制优秀档的主要因素，是页眉页脚旧项目残留、光伏系统等项目外内容、部分绝对化承诺以及具体参数来源链不够稳。",
  suggestion: "建议先清理项目外内容和旧项目痕迹，再补评分索引、来源说明和图表文字化说明，最后统一标准编号、设备参数和技术路线口径。",
};

const defaultNextSteps = [
  "立即删除旧项目名、页眉页脚残留和光伏系统施工方案。",
  "补齐施工组织设计评分响应索引，建立评分点到章节页码的映射。",
  "对现场踏勘、关键标准、设备参数、智慧工地表述增加来源链和条件边界。",
  "给总平面图、进度图、关键附表增加 80-150 字文字化说明。",
];

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

function ReportHeaderPanel({ projectInfo }: { projectInfo: ProjectInfoView }) {
  const metaItems = [
    ["用户名称", projectInfo.userName || "需补充"],
    ["参加单位", projectInfo.userOrg || "需补充"],
    ["渲染日期", projectInfo.renderDate || "需补充"],
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

function ProjectIntroPanel({ projectInfo }: { projectInfo: ProjectInfoView }) {
  const rows = [
    ["项目名称", projectInfo.title],
    ["招标编号/项目编号", projectInfo.projectNo],
    ["项目金额", projectInfo.projectAmount || "需补充"],
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
  const [searchParams] = useSearchParams();
  const { modalProps } = useResponsiveOverlay();
  const reportRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savingIssueFeedbackIds, setSavingIssueFeedbackIds] = useState<Set<string>>(() => new Set());
  const [issueFeedbackDraft, setIssueFeedbackDraft] = useState<IssueFeedbackDraft | null>(null);
  const [issueFeedbackTags, setIssueFeedbackTags] =
    useState<Record<IssueFeedback, string[]>>(DEFAULT_ISSUE_FEEDBACK_TAGS);
  const [feedbackSuggestion, setFeedbackSuggestion] = useState("");
  const [savedFeedbackSuggestion, setSavedFeedbackSuggestion] = useState("");
  const [savingReportFeedback, setSavingReportFeedback] = useState(false);
  const [viewModel, setViewModel] = useState<TechnicalReportPage2ViewModel>(
    defaultTechnicalReportPage2ViewModel,
  );

  const versionId = Number(searchParams.get("version_id"));
  const urlContext = useMemo(() => parseTechnicalReport2UrlContext(searchParams), [searchParams]);
  const displayViewModel = useMemo(
    () => mergeUrlContextIntoViewModel(viewModel, urlContext),
    [viewModel, urlContext],
  );
  const { projectInfo, dimensions, issues, optimizations, totalFullScore, totalSimulatedScore } =
    displayViewModel;

  useEffect(() => {
    if (!Number.isFinite(versionId) || versionId <= 0) {
      setViewModel(defaultTechnicalReportPage2ViewModel);
      setFeedbackSuggestion("");
      setSavedFeedbackSuggestion("");
      return;
    }

    let ignore = false;
    setLoading(true);
    fetchPublicBidVersionReportDataRaw(versionId)
      .then((response) => {
        if (!ignore) {
          const nextViewModel = buildTechnicalReportPage2ViewModel(response);
          const nextFeedbackSuggestion = nextViewModel.feedbackSuggestion ?? "";
          setViewModel(nextViewModel);
          setFeedbackSuggestion(nextFeedbackSuggestion);
          setSavedFeedbackSuggestion(nextFeedbackSuggestion);
        }
      })
      .catch((error) => {
        if (!ignore) {
          setViewModel(defaultTechnicalReportPage2ViewModel);
          setFeedbackSuggestion("");
          setSavedFeedbackSuggestion("");
          message.error(error instanceof Error ? error.message : "加载报告数据失败");
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [versionId]);

  useEffect(() => {
    fetchPublicReportFeedbackTags()
      .then((tags) => {
        const grouped = groupReportFeedbackTags(tags);
        setIssueFeedbackTags({
          like: grouped.like.length > 0 ? grouped.like : DEFAULT_ISSUE_FEEDBACK_TAGS.like,
          dislike: grouped.dislike.length > 0 ? grouped.dislike : DEFAULT_ISSUE_FEEDBACK_TAGS.dislike,
        });
      })
      .catch(() => undefined);
  }, []);

  const issueSummary = useMemo(
    () => ({
      A: issues.filter((issue) => issue.priority === "A").length,
      B: issues.filter((issue) => issue.priority === "B").length,
      C: issues.filter((issue) => issue.priority === "C").length,
    }),
    [issues],
  );

  const displayScore = Number(totalSimulatedScore.toFixed(2));
  const displayFullScore = Number(totalFullScore.toFixed(2));
  const scoreTier = useMemo(
    () => resolveScoreTier(totalSimulatedScore, totalFullScore),
    [totalSimulatedScore, totalFullScore],
  );
  const { incrementLow, incrementHigh } = useMemo(
    () => calculateOptimizationGainRange(optimizations),
    [optimizations],
  );
  const optimizedLow = (displayScore + incrementLow).toFixed(1);
  const optimizedHigh = (displayScore + incrementHigh).toFixed(1);
  const gainIncrementText = `${formatGainIncrement(incrementLow)} ~ ${formatGainIncrement(incrementHigh)}分`;
  const qualificationProbability = useMemo(
    () => calculateQualificationProbability(totalSimulatedScore, totalFullScore),
    [totalSimulatedScore, totalFullScore],
  );
  const rankingEstimate = useMemo(
    () => calculateRankingEstimate(totalSimulatedScore, totalFullScore),
    [totalSimulatedScore, totalFullScore],
  );
  const dimensionSummary =
    viewModel.dimensionSummary ??
    "技术文件已覆盖全部评分维度，先清理硬伤，再补索引、来源说明和图表文字化说明。";
  const issuePrioritySummaries = {
    A: viewModel.issuePrioritySummaries?.A ?? defaultIssuePrioritySummaries.A,
    B: viewModel.issuePrioritySummaries?.B ?? defaultIssuePrioritySummaries.B,
    C: viewModel.issuePrioritySummaries?.C ?? defaultIssuePrioritySummaries.C,
  };
  const conclusion = viewModel.conclusion ?? defaultConclusion;
  const nextSteps = viewModel.nextSteps ?? defaultNextSteps;
  const activeIssueFeedback = useMemo(
    () =>
      issueFeedbackDraft
        ? issues.find((issue) => issue.id === issueFeedbackDraft.issueId) ?? null
        : null,
    [issueFeedbackDraft, issues],
  );
  const isSavingActiveIssueFeedback = issueFeedbackDraft
    ? savingIssueFeedbackIds.has(issueFeedbackDraft.issueId)
    : false;

  const handleDownloadReport = async () => {
    if (!reportRef.current || downloading) return;

    setDownloading(true);
    let exportNode: HTMLDivElement | null = null;
    try {
      const html2canvas = (await import("html2canvas")).default;
      exportNode = reportRef.current.cloneNode(true) as HTMLDivElement;
      exportNode.querySelectorAll('[data-report-export-skip="feedback-suggestion"]').forEach((node) => node.remove());
      exportNode.setAttribute("data-report-export-temp", "true");
      exportNode.style.position = "fixed";
      exportNode.style.left = "-10000px";
      exportNode.style.top = "0";
      exportNode.style.pointerEvents = "none";
      exportNode.style.zIndex = "-1";
      document.body.appendChild(exportNode);

      await new Promise((resolve) => {
        requestAnimationFrame(resolve);
      });

      const canvas = await html2canvas(exportNode, {
        backgroundColor: "#f7fbfa",
        logging: false,
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        windowWidth: exportNode.scrollWidth,
        windowHeight: exportNode.scrollHeight,
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
      exportNode?.remove();
      setDownloading(false);
    }
  };

  const handleIssueFeedbackClick = (issue: IssueRow, feedback: IssueFeedback) => {
    if (savingIssueFeedbackIds.has(issue.id)) return;

    if (issue.feedback === feedback) {
      void clearIssueFeedback(issue.id);
      return;
    }

    if (issueFeedbackDraft?.issueId === issue.id && issueFeedbackDraft.feedback === feedback) {
      setIssueFeedbackDraft(null);
      return;
    }

    setIssueFeedbackDraft({
      issueId: issue.id,
      feedback,
      ...(issue.feedback === feedback
        ? splitFeedbackComment(feedback, issue.feedbackComment ?? "", issueFeedbackTags)
        : { selectedTags: [], comment: "" }),
    });
  };

  const toggleIssueFeedbackTag = (tag: string) => {
    if (isSavingActiveIssueFeedback) return;
    setIssueFeedbackDraft((current) => {
      if (!current) return current;
      const isSelected = current.selectedTags.includes(tag);
      const selectedTags = isSelected
        ? current.selectedTags.filter((item) => item !== tag)
        : [...current.selectedTags, tag];
      if (!isSelected && getFeedbackDraftLength({ ...current, selectedTags }).length > 2000) {
        message.warning("反馈内容不能超过2000字");
        return current;
      }
      return { ...current, selectedTags };
    });
  };

  const submitIssueFeedback = async () => {
    if (!issueFeedbackDraft || !Number.isFinite(versionId) || versionId <= 0) return;

    const { issueId, feedback, selectedTags, comment } = issueFeedbackDraft;
    const trimmedComment = buildFeedbackComment(selectedTags, comment);
    if (!trimmedComment) {
      message.warning(feedback === "like" ? "请选择标签或填写好在哪里" : "请选择标签或填写不足的地方");
      return;
    }
    if (trimmedComment.length > 2000) {
      message.warning("反馈内容不能超过2000字");
      return;
    }
    if (savingIssueFeedbackIds.has(issueId)) return;

    const previousIssue = issues.find((issue) => issue.id === issueId);
    const previousFeedback = previousIssue?.feedback;
    const previousComment = previousIssue?.feedbackComment;

    setSavingIssueFeedbackIds((current) => new Set(current).add(issueId));
    setViewModel((current) => ({
      ...current,
      issues: current.issues.map((issue) =>
        issue.id === issueId
          ? {
              ...issue,
              feedback,
              feedbackComment: trimmedComment,
            }
          : issue,
      ),
    }));

    try {
      const response = await updatePublicBidVersionIssueFeedback({
        attachmentId: versionId,
        issueId,
        feedback,
        comment: trimmedComment,
      });
      setViewModel(buildTechnicalReportPage2ViewModel(response));
      setIssueFeedbackDraft(null);
      message.success("反馈已保存");
    } catch (error) {
      setViewModel((current) => ({
        ...current,
        issues: current.issues.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                feedback: previousFeedback,
                feedbackComment: previousComment,
              }
            : issue,
        ),
      }));
      message.error(error instanceof Error ? error.message : "反馈保存失败，请稍后重试");
    } finally {
      setSavingIssueFeedbackIds((current) => {
        const next = new Set(current);
        next.delete(issueId);
        return next;
      });
    }
  };

  const clearIssueFeedback = async (issueId: string) => {
    if (!Number.isFinite(versionId) || versionId <= 0 || savingIssueFeedbackIds.has(issueId)) return;

    const previousIssue = issues.find((issue) => issue.id === issueId);
    const previousFeedback = previousIssue?.feedback;
    const previousComment = previousIssue?.feedbackComment;

    setSavingIssueFeedbackIds((current) => new Set(current).add(issueId));
    setIssueFeedbackDraft(null);
    setViewModel((current) => ({
      ...current,
      issues: current.issues.map((issue) =>
        issue.id === issueId
          ? {
              ...issue,
              feedback: undefined,
              feedbackComment: undefined,
            }
          : issue,
      ),
    }));

    try {
      const response = await updatePublicBidVersionIssueFeedback({
        attachmentId: versionId,
        issueId,
        feedback: null,
        comment: null,
      });
      setViewModel(buildTechnicalReportPage2ViewModel(response));
      message.success("反馈已清除");
    } catch (error) {
      setViewModel((current) => ({
        ...current,
        issues: current.issues.map((issue) =>
          issue.id === issueId
            ? {
                ...issue,
                feedback: previousFeedback,
                feedbackComment: previousComment,
              }
            : issue,
        ),
      }));
      message.error(error instanceof Error ? error.message : "清除反馈失败，请稍后重试");
    } finally {
      setSavingIssueFeedbackIds((current) => {
        const next = new Set(current);
        next.delete(issueId);
        return next;
      });
    }
  };

  const handleSaveReportFeedback = async () => {
    if (!Number.isFinite(versionId) || versionId <= 0 || savingReportFeedback) return;

    setSavingReportFeedback(true);
    try {
      const response = await updatePublicBidVersionReportFeedback({
        attachmentId: versionId,
        feedback: feedbackSuggestion,
      });
      const nextViewModel = buildTechnicalReportPage2ViewModel(response);
      const nextFeedbackSuggestion = nextViewModel.feedbackSuggestion ?? "";
      setViewModel(nextViewModel);
      setFeedbackSuggestion(nextFeedbackSuggestion);
      setSavedFeedbackSuggestion(nextFeedbackSuggestion);
      message.success("反馈建议已保存");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "反馈建议保存失败，请稍后重试");
    } finally {
      setSavingReportFeedback(false);
    }
  };

  const scoreGaugeOption = useMemo(
    () => ({
      animation: false,
      series: [
        {
          type: "gauge",
          min: 0,
          max: displayFullScore,
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
            formatter: (value: number) =>
              `{score|${value.toFixed(2)}}\n{unit|/${displayFullScore % 1 === 0 ? displayFullScore.toFixed(0) : displayFullScore.toFixed(2)}}`,
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
    [displayScore, displayFullScore],
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
    [dimensions],
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
    [issueSummary],
  );

  const issueTypeMax = Math.max(
    issues.filter((item) => item.type === "删除类").length,
    issues.filter((item) => item.type === "修改类").length,
    issues.filter((item) => item.type === "增补类").length,
    1,
  );

  const issueTypeOption = useMemo(
    () => ({
      animation: false,
      color: ["#0f9f8f"],
      grid: { left: 72, right: 24, top: 16, bottom: 18 },
      xAxis: {
        type: "value",
        max: issueTypeMax,
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
    [issues, issueTypeMax],
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
        max: displayScore + Math.max(incrementHigh + 1, 2),
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
          data: [displayScore, displayScore + incrementLow, displayScore + incrementHigh],
        },
      ],
    }),
    [displayScore, incrementLow, incrementHigh],
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
        {/* <div className="mx-auto flex max-w-[1180px] justify-end px-4 py-3">
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            loading={downloading}
            onClick={handleDownloadReport}
          >
            下载报告
          </Button>
        </div> */}
      </div>

      <div ref={reportRef} className="bg-[#f7fbfa] pb-12">
        <ReportHeaderPanel projectInfo={projectInfo} />

        <main className="mx-auto max-w-[1180px] px-4 py-6 md:py-8">
          <Spin spinning={loading}>
          <ProjectIntroPanel projectInfo={projectInfo} />

        <section className="mb-8">
          <ModuleSectionTitle title="二、综合评分概览" />
          <div className="grid gap-4 lg:grid-cols-[260px_1fr_280px]">
            <div className="flex flex-col items-center justify-center rounded-lg border border-slate-100 bg-white px-4 py-6 shadow-sm">
              <div className="h-48 w-full">
                <ReactEcharts option={scoreGaugeOption} renderer="svg" />
              </div>
              <span
                className={`mt-3 inline-flex rounded-full px-8 py-2 text-sm font-bold ${scoreTier.tier.badgeClassName}`}
              >
                {scoreTier.tier.label}
              </span>
            </div>

            <div className="flex flex-col rounded-lg border border-slate-100 bg-white shadow-sm">
              <div className="grid grid-cols-3 gap-4 px-6 py-6">
                <OverviewMetric
                  label="得分区间"
                  value={scoreTier.scoreRangeText}
                  hint={scoreTier.tier.hint}
                />
                <OverviewMetric
                  label="入围概率"
                  value={`${qualificationProbability}%`}
                  hint="预测概率"
                />
                <OverviewMetric
                  label="排名预估"
                  value={rankingEstimate.text}
                  hint={rankingEstimate.hint}
                />
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
                <div className="mt-1 text-3xl font-bold text-[#f53f3f]">{gainIncrementText}</div>
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
                        {dimensionSummary}
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
              <div className="mb-2 font-semibold text-red-700">A类 必须修改（{issueSummary.A}项）</div>
              <p className="mb-0 text-sm leading-7 text-red-800">{issuePrioritySummaries.A}</p>
            </div>
            <div className="rounded border border-orange-100 bg-orange-50 p-5">
              <div className="mb-2 font-semibold text-orange-700">B类 建议修改（{issueSummary.B}项）</div>
              <p className="mb-0 text-sm leading-7 text-orange-800">{issuePrioritySummaries.B}</p>
            </div>
            <div className="rounded border border-emerald-100 bg-emerald-50 p-5">
              <div className="mb-2 font-semibold text-emerald-700">C类 优化提升（{issueSummary.C}项）</div>
              <p className="mb-0 text-sm leading-7 text-emerald-800">{issuePrioritySummaries.C}</p>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <ModuleSectionTitle title="五、核心问题清单（按优先级）" subtitle="每个问题都保留 PDF 报告中的定位、判断逻辑、修复建议和改完自查。" />
          <div className="space-y-4">
            {issues.map((issue) => {
              const meta = priorityMeta[issue.priority];
              const isLiked = issue.feedback === "like";
              const isDisliked = issue.feedback === "dislike";
              const isSavingIssueFeedback = savingIssueFeedbackIds.has(issue.id);
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
                  <div className="mt-4 flex flex-col items-end gap-3">
                    <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white/80 px-2 py-1 shadow-sm">
                      <span className="px-1 text-xs text-slate-500">问题反馈</span>
                      <Tooltip title={isLiked ? "再次点击取消反馈" : "这个问题有帮助"}>
                        <Button
                          aria-label={`反馈问题 ${issue.id} 有帮助`}
                          aria-pressed={isLiked}
                          icon={<LikeOutlined />}
                          loading={isSavingIssueFeedback}
                          shape="circle"
                          size="small"
                          type={isLiked ? "primary" : "default"}
                          disabled={isSavingIssueFeedback}
                          onClick={() => handleIssueFeedbackClick(issue, "like")}
                        />
                      </Tooltip>
                      <Tooltip title={isDisliked ? "再次点击取消反馈" : "这个问题不好"}>
                        <Button
                          aria-label={`反馈问题 ${issue.id} 不足`}
                          aria-pressed={isDisliked}
                          danger={isDisliked}
                          icon={<DislikeOutlined />}
                          loading={isSavingIssueFeedback}
                          shape="circle"
                          size="small"
                          type={isDisliked ? "primary" : "default"}
                          disabled={isSavingIssueFeedback}
                          onClick={() => handleIssueFeedbackClick(issue, "dislike")}
                        />
                      </Tooltip>
                    </div>

                    {issue.feedbackComment && (!issueFeedbackDraft || issueFeedbackDraft.issueId !== issue.id) && (
                      <div className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                        <span className="font-medium text-slate-700">
                          {issue.feedback === "like" ? "好在哪里：" : "不足之处："}
                        </span>
                        {issue.feedbackComment}
                      </div>
                    )}
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

        <section className="mb-8">
          <ModuleSectionTitle title="七、评审结论与下一步" subtitle="先处理明显硬伤，再做结构化补强，最后统一口径。" />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <ExclamationCircleOutlined className="text-orange-600" />
                综合结论
              </div>
              <p className="mb-4 text-sm leading-7 text-slate-700">{conclusion.main}</p>
              <div className="rounded border border-teal-100 bg-teal-50 p-4 text-sm leading-7 text-teal-900">
                {conclusion.suggestion}
              </div>
            </div>
            <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900">
                <CheckCircleOutlined className="text-teal-700" />
                下一步行动
              </div>
              <ol className="mb-0 space-y-3 pl-0">
                {nextSteps.map((item, index) => (
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

        <section data-report-export-skip="feedback-suggestion">
          <ModuleSectionTitle title="八、反馈建议" subtitle="欢迎留下对整篇报告的意见和建议，我们会将其用于后续系统升级。" />
          <div className="rounded border border-slate-200 bg-white p-5 shadow-sm">
            <Input.TextArea
              value={feedbackSuggestion}
              onChange={(event) => setFeedbackSuggestion(event.target.value)}
              autoSize={{ minRows: 5, maxRows: 10 }}
              maxLength={2000}
              showCount
              placeholder="请输入对本报告的反馈建议"
              disabled={savingReportFeedback}
            />
            <div className="mt-5 flex justify-end">
              <Button
                type="primary"
                loading={savingReportFeedback}
                disabled={feedbackSuggestion.trim() === savedFeedbackSuggestion}
                onClick={handleSaveReportFeedback}
              >
                保存反馈
              </Button>
            </div>
          </div>
        </section>
          </Spin>
        </main>
      </div>

      <Modal
        open={Boolean(issueFeedbackDraft)}
        title={
          issueFeedbackDraft?.feedback === "like" ? "好在哪里" : "不足的地方在哪里"
        }
        centered
        width={480}
        destroyOnClose
        maskClosable={!isSavingActiveIssueFeedback}
        onCancel={() => {
          if (!isSavingActiveIssueFeedback) setIssueFeedbackDraft(null);
        }}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              disabled={isSavingActiveIssueFeedback}
              onClick={() => setIssueFeedbackDraft(null)}
            >
              取消
            </Button>
            {activeIssueFeedback?.feedback && issueFeedbackDraft && (
              <Button
                danger
                loading={isSavingActiveIssueFeedback}
                onClick={() => void clearIssueFeedback(issueFeedbackDraft.issueId)}
              >
                清除反馈
              </Button>
            )}
            <Button
              type="primary"
              loading={isSavingActiveIssueFeedback}
              onClick={() => void submitIssueFeedback()}
            >
              提交反馈
            </Button>
          </div>
        }
        styles={{
          mask: { backgroundColor: "rgba(15, 23, 42, 0.28)" },
          content: { borderRadius: 12, overflow: "hidden", boxShadow: "0 16px 48px rgba(15, 23, 42, 0.12)" },
          header: { paddingBottom: 8 },
          body: { paddingTop: 8 },
        }}
        {...modalProps}
      >
        {issueFeedbackDraft && (
          <div className="space-y-3">
            {activeIssueFeedback?.title && (
              <Typography.Paragraph type="secondary" className="!mb-0 text-sm leading-6">
                问题：{activeIssueFeedback.title}
              </Typography.Paragraph>
            )}
            <div
              className={`rounded-md border border-[#d9d9d9] bg-white px-3 py-2 transition-all focus-within:border-[#4096ff] focus-within:shadow-[0_0_0_2px_rgba(5,145,255,0.1)] ${
                isSavingActiveIssueFeedback ? "bg-[#fafafa]" : ""
              }`}
            >
              {issueFeedbackDraft.selectedTags.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {issueFeedbackDraft.selectedTags.map((tag) => (
                    <Tag
                      key={tag}
                      closable={!isSavingActiveIssueFeedback}
                      className="!m-0"
                      color={issueFeedbackDraft.feedback === "like" ? "success" : "warning"}
                      onClose={() => toggleIssueFeedbackTag(tag)}
                    >
                      {tag}
                    </Tag>
                  ))}
                </div>
              )}

              <Input.TextArea
                value={issueFeedbackDraft.comment}
                onChange={(event) =>
                  setIssueFeedbackDraft((current) =>
                    current ? { ...current, comment: event.target.value } : current,
                  )
                }
                variant="borderless"
                autoSize={{ minRows: 3, maxRows: 6 }}
                maxLength={2000}
                placeholder={
                  issueFeedbackDraft.selectedTags.length > 0
                    ? "可继续补充说明（选填）"
                    : ISSUE_FEEDBACK_PLACEHOLDERS[issueFeedbackDraft.feedback]
                }
                disabled={isSavingActiveIssueFeedback}
                className="!px-0 !py-0"
              />

              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2">
                {issueFeedbackTags[issueFeedbackDraft.feedback].map((tag) => {
                  const selected = issueFeedbackDraft.selectedTags.includes(tag);
                  return (
                    <Tag
                      key={tag}
                      className={`!m-0 cursor-pointer select-none transition-all ${
                        selected ? "ring-1 ring-offset-1" : "opacity-80 hover:opacity-100"
                      }`}
                      color={
                        selected
                          ? issueFeedbackDraft.feedback === "like"
                            ? "success"
                            : "warning"
                          : "default"
                      }
                      onClick={() => toggleIssueFeedbackTag(tag)}
                    >
                      {tag}
                    </Tag>
                  );
                })}
              </div>
            </div>
            <div className="text-right text-xs text-slate-400">
              {getFeedbackDraftLength(issueFeedbackDraft)}/2000
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
