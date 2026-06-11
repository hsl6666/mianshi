import { useCallback, useEffect, useState } from "react";
import {
  Button,
  Card,
  FloatButton,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Typography,
  message,
} from "antd";
import { fetchUsers, type UserItem } from "@/api/auth";
import { PlusOutlined } from "@ant-design/icons";
import { useIsMobile } from "@/hooks/useIsMobile";
import { usePermission } from "@/hooks/usePermission";
import {
  analyzeThirdPartySubmissionFile,
  analyzeThirdPartyPublicSubmissionFile,
  uploadThirdPartyProjectBidFile,
} from "@/api/wangjun";
import { getWangjunAccessToken, isWangjunLoginEnabled } from "@/utils/wangjunAuth";
import type { BiddingAccess } from "@/constants/permissions";
import {
  createGroup,
  syncGroupThirdParty,
  bindBidVersionThirdPartySubmission,
  createProject,
  deleteBidVersion,
  deleteCompany,
  deleteGroup,
	  deleteProject,
	  downloadBidVersion,
	  downloadBidVersionReport,
	  downloadGroupAttachment,
  downloadProjectAttachment,
  fetchCompany,
  fetchProject,
  fetchProjects,
  previewBidVersion,
  submitFeedback,
  updateGroup,
  updateProject,
  updateBidVersionAnalysisStatus,
  updateBidVersionThirdPartySyncStatus,
  uploadBidVersionReport,
  uploadBidVersionReportData,
} from "../api";
import FeedbackModal from "../components/FeedbackModal";
import GroupFormModal from "../components/GroupFormModal";
import ProjectHierarchyPanel from "../components/ProjectHierarchyPanel";
import ProjectDetailDrawer from "../components/ProjectDetailDrawer";
import ProjectFormModal from "../components/ProjectFormModal";
import ProjectMobileCardList from "../components/ProjectMobileCardList";
import { PROJECT_STATUS_MAP } from "../constants";
import type {
  BidVersionListItem,
  BiddingCompanyListItem,
  BiddingProjectDetail,
  BiddingProjectGroupTreeItem,
  BiddingProjectListItem,
  FeedbackFormValues,
  FeedbackTarget,
  GroupFormValues,
  ProjectFormValues,
  ProjectRevisionPreset,
	  ProjectStatus,
	  ThirdPartySyncStatus,
	} from "../types";

function getGroupTenderFile(group: BiddingProjectGroupTreeItem) {
  const groupTender = group.attachments.find((file) => file.attachment_type === "tender_doc");
  if (groupTender) {
    return { source: "group" as const, groupId: group.db_id, attachment: groupTender };
  }

  for (const project of group.children) {
    const projectTender = project.attachments.find((file) => file.attachment_type === "tender_doc");
    if (projectTender) {
      return {
        source: "project" as const,
        projectId: project.id,
        attachment: projectTender,
      };
    }
  }

  return null;
}

export default function ProjectListPage() {
  const isMobile = useIsMobile();
  const { can, isSuperAdmin } = usePermission();
  const biddingAccess: BiddingAccess = {
    canView: can("bidding", "view"),
    canCreate: can("bidding", "create"),
    canEdit: can("bidding", "edit"),
    canDelete: can("bidding", "delete"),
    canFeedback: can("bidding", "feedback"),
    canPreview: can("bidding", "preview"),
    canDownload: can("bidding", "download"),
    canReportView: can("bidding", "report_view"),
    canReportUpload: can("bidding", "report_upload"),
    canReportJson: can("bidding", "report_json"),
    canReportPage: can("bidding", "report_page"),
    canReportDownload: can("bidding", "report_download"),
    canAnalysis: can("bidding", "analysis"),
    canSync: can("bidding", "sync"),
  };
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "">("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [userOptions, setUserOptions] = useState<UserItem[]>([]);
  const [userLoading, setUserLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState<BiddingProjectGroupTreeItem[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeProject, setActiveProject] = useState<BiddingProjectDetail | null>(null);
  const [activeFeedbackTarget, setActiveFeedbackTarget] = useState<FeedbackTarget | null>(null);
  const [editingGroup, setEditingGroup] = useState<{ id: number; name: string } | null>(null);
  const [presetGroupId, setPresetGroupId] = useState<number | null>(null);
  const [presetRevision, setPresetRevision] = useState<ProjectRevisionPreset | null>(null);
  const [jsonUploadOpen, setJsonUploadOpen] = useState(false);
  const [jsonUploadTarget, setJsonUploadTarget] = useState<BidVersionListItem | null>(null);
  const [jsonUploadText, setJsonUploadText] = useState("");
  const [jsonUploadSubmitting, setJsonUploadSubmitting] = useState(false);
  const [analyzingVersionIds, setAnalyzingVersionIds] = useState<Set<number>>(() => new Set());

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchProjects({
        page,
        page_size: pageSize,
        keyword: keyword || undefined,
        status: statusFilter || undefined,
        owner: isSuperAdmin && ownerFilter ? ownerFilter : undefined,
      });
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载项目列表失败");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, statusFilter, ownerFilter, isSuperAdmin]);

  useEffect(() => {
    loadList();
  }, [loadList]);

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

  const openDetail = async (id: number) => {
    try {
      const project = await fetchProject(id);
      setActiveProject(project);
      setDetailOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载详情失败");
    }
  };

  const openCreate = (groupId?: number) => {
    setActiveProject(null);
    setPresetRevision(null);
    setPresetGroupId(groupId ?? null);
    setFormOpen(true);
  };

  const openUploadRevision = (
    groupId: number,
    project: Pick<BiddingProjectListItem, "name" | "bid_opening_time">,
    company: Pick<BiddingCompanyListItem, "name">,
  ) => {
    setActiveProject(null);
    setPresetGroupId(null);
    setPresetRevision({
      dbId: groupId,
      projectName: project.name,
      companyName: company.name,
      bidOpeningAt: project.bid_opening_time,
    });
    setFormOpen(true);
  };

  const openEditGroup = (group: BiddingProjectGroupTreeItem) => {
    setEditingGroup({ id: group.db_id, name: group.project_name });
    setGroupFormOpen(true);
  };

  const openEdit = async (id: number) => {
    try {
      const project = await fetchProject(id);
      setActiveProject(project);
      setPresetGroupId(null);
      setPresetRevision(null);
      setFormOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载项目失败");
    }
  };

  const openFeedback = async (company: BiddingCompanyListItem, project: BiddingProjectListItem) => {
    if (company.status === "registered") {
      message.warning("开标时间未到，暂不可提交评审反馈");
      return;
    }
    try {
      const detail = await fetchCompany(company.id);
      setActiveFeedbackTarget({
        companyId: company.id,
        companyName: company.name,
        projectName: project.name,
        feedback: detail.feedback,
      });
      setFeedbackOpen(true);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "加载投标单位失败");
    }
  };

  const handleFormSubmit = async (values: ProjectFormValues) => {
    setSubmitting(true);
    try {
      if (activeProject) {
        await updateProject(activeProject.id, {
          name: values.name!,
          participating_units: values.participating_units!,
        });
        message.success("项目已更新");
      } else if (
        values.group_mode === "new" &&
        !presetGroupId &&
        !presetRevision &&
        values.project_name &&
        !values.name
      ) {
        const created = await createGroup(values.project_name, values.bid_file, values.bid_opening_time, {
          thirdPartyFileName: values.bid_file?.name,
        });

        let thirdPartyError: string | null = null;
        if (isWangjunLoginEnabled()) {
          if (!getWangjunAccessToken()) {
            thirdPartyError = "第三方未登录，请刷新页面后重试";
          } else if (values.bid_file) {
            try {
              const thirdParty = await uploadThirdPartyProjectBidFile({
                bidFile: values.bid_file,
                projectName: values.project_name,
                bidOpeningTime: values.bid_opening_time ?? created.bid_opening_time,
                thirdPartyFileName: values.bid_file.name,
              });
              await syncGroupThirdParty(created.db_id, thirdParty.project);
            } catch (error) {
              thirdPartyError = error instanceof Error ? error.message : "第三方上传失败";
            }
          }
        }

        if (thirdPartyError) {
          message.warning(`项目已创建，第三方上传失败：${thirdPartyError}`);
        } else {
          message.success("项目已创建");
        }
      } else {
        const created = await createProject(values);
        const companyName = values.participating_units?.trim() || "";
        const uploadedVersion = created.companies
          .find((company) => company.name === companyName)
          ?.attachments[0];
        const thirdPartyProjectId = created.third_party_db_id || created.project_id || created.project_code;

        let thirdPartyError: string | null = null;
        if (values.bid_file && uploadedVersion && isWangjunLoginEnabled()) {
          if (!getWangjunAccessToken()) {
            thirdPartyError = "未获取三方 token，未提交三方分析";
          } else if (!thirdPartyProjectId) {
            thirdPartyError = "项目组未绑定三方项目 ID";
          } else {
            try {
              const thirdParty = await analyzeThirdPartySubmissionFile({
                projectId: String(thirdPartyProjectId),
                projectCode: created.project_code,
                companyName,
                responseFile: values.bid_file,
                thirdPartyFileName: values.bid_file.name,
                thirdPartyCompanyName: companyName,
              });
              const submissionFileId = thirdParty.submission_file?.id?.trim();
              if (!submissionFileId) {
                thirdPartyError = "三方响应缺少 submission_file.id";
              } else {
                await bindBidVersionThirdPartySubmission({
                  attachmentId: uploadedVersion.id,
                  submissionFileId,
                  status: thirdParty.status,
                  report: thirdParty.report,
                  reportData: thirdParty.report_data,
                });
              }
            } catch (error) {
              thirdPartyError = error instanceof Error ? error.message : "三方分析提交失败";
            }
          }
        } else if (values.bid_file && !uploadedVersion) {
          thirdPartyError = "未找到本平台投标文件版本，无法绑定三方 submission_file.id";
        }

        if (thirdPartyError) {
          message.warning(`投标文件已上传，但三方分析提交未完成：${thirdPartyError}`);
        } else {
          message.success(presetRevision ? "新版投标文件已上传" : "项目已登记");
        }
      }
      setFormOpen(false);
      setActiveProject(null);
      setPresetGroupId(null);
      setPresetRevision(null);
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGroupFormSubmit = async (values: GroupFormValues) => {
    if (!editingGroup) return;
    setSubmitting(true);
    try {
      await updateGroup(editingGroup.id, values);
      message.success("项目已更新");
      setGroupFormOpen(false);
      setEditingGroup(null);
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleFeedbackSubmit = async (values: FeedbackFormValues) => {
    if (!activeFeedbackTarget) return;
    setSubmitting(true);
    try {
      await submitFeedback(activeFeedbackTarget.companyId, values);
      message.success("评审反馈已保存");
      setFeedbackOpen(false);
      setActiveFeedbackTarget(null);
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteProject(id);
      message.success("项目已删除");
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleDeleteGroup = (group: BiddingProjectGroupTreeItem) => {
    Modal.confirm({
      title: "确定删除该项目组？",
      content: `将删除「${group.project_name}」项目组，以及组内所有参加单位、文件版本和报告数据。该操作不可恢复。`,
      okText: "删除项目组",
      okButtonProps: { danger: true },
      cancelText: "取消",
      async onOk() {
        try {
          await deleteGroup(group.db_id);
          message.success("项目组已删除");
          await loadList();
        } catch (error) {
          message.error(error instanceof Error ? error.message : "删除项目组失败");
          throw error;
        }
      },
    });
  };

  const handleDeleteBidVersion = async (id: number) => {
    try {
      await deleteBidVersion(id);
      message.success("版本已删除");
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const handleDownloadVersion = async (record: BidVersionListItem) => {
    try {
      await downloadBidVersion({ attachmentId: record.id, filename: record.original_name });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载失败");
    }
  };

	  const handleDownloadVersionReport = async (record: BidVersionListItem) => {
    if (!record.report_original_name) {
      message.warning("暂无报告可下载");
      return;
    }
    try {
      await downloadBidVersionReport({ attachmentId: record.id, filename: record.report_original_name });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载报告失败");
    }
	  };

  const handleDownloadGroupTender = async (group: BiddingProjectGroupTreeItem) => {
    const tenderFile = getGroupTenderFile(group);
    if (!tenderFile) {
      message.warning("暂无招标文件可下载");
      return;
    }

    try {
      if (tenderFile.source === "group") {
        await downloadGroupAttachment({
          groupId: tenderFile.groupId,
          attachmentId: tenderFile.attachment.id,
          filename: tenderFile.attachment.original_name,
        });
      } else {
        await downloadProjectAttachment({
          projectId: tenderFile.projectId,
          attachmentId: tenderFile.attachment.id,
          filename: tenderFile.attachment.original_name,
        });
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载招标文件失败");
    }
  };

  const handlePreviewVersion = async (record: BidVersionListItem) => {
    await previewBidVersion({ attachmentId: record.id, filename: record.original_name });
  };

  const patchVersion = (attachmentId: number, fields: Partial<BidVersionListItem>) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId ? { ...version, ...fields } : version,
            ),
          })),
        })),
      })),
    );
  };

  const handleAnalyzeVersion = async (record: BidVersionListItem) => {
    if (analyzingVersionIds.has(record.id)) return;

    if (!isWangjunLoginEnabled()) {
      message.warning("未启用三方分析");
      return;
    }
    if (!getWangjunAccessToken()) {
      message.error("未获取三方 token，请刷新页面后重试");
      return;
    }

    const submissionFileId = record.third_party_submission_file_id?.trim();
    if (!submissionFileId) {
      message.error("投标文件未绑定 submission_file.id，无法提交分析");
      return;
    }

    setAnalyzingVersionIds((prev) => new Set(prev).add(record.id));
    patchVersion(record.id, { report_status: "analyzing" });

    try {
      const thirdParty = await analyzeThirdPartyPublicSubmissionFile({ submissionFileId });
      const next = await bindBidVersionThirdPartySubmission({
        attachmentId: record.id,
        submissionFileId,
        status: thirdParty.status,
        report: thirdParty.report,
        reportData: thirdParty.report_data,
      });
      patchVersionReport(record.id, {
        report_original_name: next.report_original_name ?? null,
        report_size_bytes: next.report_size_bytes ?? null,
        report_uploaded_at: next.report_uploaded_at ?? null,
        report_has_data: next.report_has_data ?? false,
        report_title: next.report_title ?? null,
        report_final_score: next.report_final_score ?? null,
        report_rating: next.report_rating ?? null,
        analysis_status: next.analysis_status ?? true,
        report_status: next.report_status ?? "analyzing",
        third_party_submission_file_id:
          next.third_party_submission_file_id ?? record.third_party_submission_file_id,
      });
      message.success(
        next.report_status === "completed" ? "分析完成" : "已提交分析，请稍后刷新查看结果",
      );
      await loadList();
    } catch (error) {
      patchVersion(record.id, { report_status: "failed" });
      message.error(error instanceof Error ? error.message : "分析提交失败");
    } finally {
      setAnalyzingVersionIds((prev) => {
        const nextIds = new Set(prev);
        nextIds.delete(record.id);
        return nextIds;
      });
    }
  };

  const patchVersionAnalysisStatus = (attachmentId: number, analysisStatus: boolean) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId ? { ...version, analysis_status: analysisStatus } : version,
            ),
          })),
        })),
      })),
    );
  };

  const patchVersionThirdPartySyncStatus = (
    attachmentId: number,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId
                ? { ...version, third_party_sync_status: thirdPartySyncStatus }
                : version,
            ),
          })),
        })),
      })),
    );
  };

  const patchVersionReport = (
    attachmentId: number,
	    report: Pick<BidVersionListItem, "report_original_name" | "report_size_bytes" | "report_uploaded_at"> & {
	      analysis_status: boolean;
	      report_has_data?: boolean;
	      report_title?: string | null;
	      report_final_score?: number | null;
	      report_rating?: string | null;
	      report_status?: BidVersionListItem["report_status"];
	      third_party_submission_file_id?: string | null;
	    },
  ) => {
    setItems((prev) =>
      prev.map((group) => ({
        ...group,
        children: group.children.map((project) => ({
          ...project,
          children: project.children.map((company) => ({
            ...company,
            children: company.children.map((version) =>
              version.id === attachmentId
                ? {
                    ...version,
                    report_original_name: report.report_original_name,
	                    report_size_bytes: report.report_size_bytes,
	                    report_uploaded_at: report.report_uploaded_at,
	                    report_has_data: report.report_has_data ?? version.report_has_data,
	                    report_title: report.report_title ?? version.report_title,
	                    report_final_score: report.report_final_score ?? version.report_final_score,
	                    report_rating: report.report_rating ?? version.report_rating,
	                    analysis_status: report.analysis_status,
	                    report_status: report.report_status ?? version.report_status,
	                    third_party_submission_file_id:
	                      report.third_party_submission_file_id ?? version.third_party_submission_file_id,
                  }
                : version,
            ),
          })),
        })),
      })),
    );
  };

  const handleAnalysisStatusChange = async (record: BidVersionListItem, analysisStatus: boolean) => {
    const previous = record.analysis_status;
    patchVersionAnalysisStatus(record.id, analysisStatus);
    try {
      await updateBidVersionAnalysisStatus({ attachmentId: record.id, analysisStatus });
      message.success(analysisStatus ? "已标记为已分析" : "已标记为未分析");
    } catch (error) {
      patchVersionAnalysisStatus(record.id, previous);
      message.error(error instanceof Error ? error.message : "更新分析状态失败");
    }
  };

  const handleThirdPartySyncStatusChange = async (
    record: BidVersionListItem,
    thirdPartySyncStatus: ThirdPartySyncStatus,
  ) => {
    const previous = record.third_party_sync_status;
    patchVersionThirdPartySyncStatus(record.id, thirdPartySyncStatus);
    try {
      await updateBidVersionThirdPartySyncStatus({
        attachmentId: record.id,
        thirdPartySyncStatus,
      });
      message.success(thirdPartySyncStatus === "synced" ? "已标记为已同步" : "已标记为未同步");
    } catch (error) {
      patchVersionThirdPartySyncStatus(record.id, previous);
      message.error(error instanceof Error ? error.message : "更新三方同步状态失败");
    }
  };

  const handleUploadVersionReport = async (record: BidVersionListItem, file: File) => {
    try {
      const next = await uploadBidVersionReport({ attachmentId: record.id, file });
      patchVersionReport(record.id, {
        report_original_name: next.report_original_name ?? null,
	        report_size_bytes: next.report_size_bytes ?? null,
	        report_uploaded_at: next.report_uploaded_at ?? null,
	        report_has_data: next.report_has_data ?? false,
	        report_title: next.report_title ?? null,
	        report_final_score: next.report_final_score ?? null,
	        report_rating: next.report_rating ?? null,
	        analysis_status: next.analysis_status ?? true,
      });
      message.success("报告已上传");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "上传报告失败");
    }
  };

  const openJsonUpload = (record: BidVersionListItem) => {
    setJsonUploadTarget(record);
    setJsonUploadText("");
    setJsonUploadOpen(true);
  };

  const handleJsonUploadSubmit = async () => {
    if (!jsonUploadTarget) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonUploadText);
    } catch {
      message.error("JSON 格式错误，请检查后重试");
      return;
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      message.error("JSON 必须是对象");
      return;
    }

    const payload = { ...(parsed as Record<string, unknown>) };
    const submissionFileId =
      (typeof payload.submission_file_id === "string" && payload.submission_file_id.trim()) ||
      (typeof payload.submission_file === "object" &&
        payload.submission_file !== null &&
        typeof (payload.submission_file as { id?: string }).id === "string" &&
        (payload.submission_file as { id: string }).id.trim()) ||
      jsonUploadTarget.third_party_submission_file_id ||
      null;

    if (!submissionFileId) {
      message.error("JSON 中需包含 submission_file_id，请确认投标文件上传时已成功提交至三方");
      return;
    }
    if (!payload.submission_file_id) {
      payload.submission_file_id = submissionFileId;
    }

    setJsonUploadSubmitting(true);
    try {
      const next = await uploadBidVersionReportData({
        reportData: payload as Parameters<typeof uploadBidVersionReportData>[0]["reportData"],
      });
      patchVersionReport(jsonUploadTarget.id, {
        report_original_name: next.report_original_name ?? null,
        report_size_bytes: next.report_size_bytes ?? null,
        report_uploaded_at: next.report_uploaded_at ?? null,
        report_has_data: next.report_has_data ?? true,
        report_title: next.report_title ?? null,
        report_final_score: next.report_final_score ?? null,
        report_rating: next.report_rating ?? null,
        analysis_status: next.analysis_status ?? true,
        report_status: next.report_status ?? "completed",
        third_party_submission_file_id:
          next.third_party_submission_file_id ?? jsonUploadTarget.third_party_submission_file_id,
      });
      message.success("报告数据已保存");
      setJsonUploadOpen(false);
      setJsonUploadTarget(null);
      setJsonUploadText("");
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    } finally {
      setJsonUploadSubmitting(false);
    }
  };

  const handleDeleteCompany = async (id: number) => {
    try {
      await deleteCompany(id);
      message.success("投标单位已删除");
      await loadList();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "删除失败");
    }
  };

  const filterBar = (
    <div className="mb-4 flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3">
      <Input.Search
        allowClear
        placeholder="搜索开标日期、项目或参加单位"
        className="w-full sm:!w-80"
        onSearch={(value) => {
          setKeyword(value.trim());
          setPage(1);
        }}
      />
      <Select
        allowClear
        placeholder="项目状态"
        className="w-full sm:!w-36"
        value={statusFilter || undefined}
        onChange={(value) => {
          setStatusFilter((value as ProjectStatus) || "");
          setPage(1);
        }}
        options={Object.entries(PROJECT_STATUS_MAP).map(([value, meta]) => ({
          value,
          label: meta.label,
        }))}
      />
      {isSuperAdmin && (
        <Select
          allowClear
          showSearch
          placeholder="按用户筛选"
          className="w-full sm:!w-48"
          loading={userLoading}
          value={ownerFilter || undefined}
          optionFilterProp="label"
          onChange={(value) => {
            setOwnerFilter(value || "");
            setPage(1);
          }}
          options={userOptions.map((user) => {
            const displayName = user.display_name?.trim();
            const label = displayName && displayName !== user.username
              ? `${displayName}（${user.username}）`
              : user.username;
            return {
              value: user.username,
              label,
            };
          })}
        />
      )}
      <Button onClick={loadList} className="w-full sm:w-auto">
        刷新
      </Button>
    </div>
  );

  const paginationNode = (
    <div className="mt-4 flex justify-center md:justify-end">
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        size={isMobile ? "small" : "middle"}
        showSizeChanger={!isMobile}
        showTotal={isMobile ? undefined : (t) => `共 ${t} 个开标日`}
        onChange={(nextPage, nextSize) => {
          setPage(nextPage);
          setPageSize(nextSize ?? pageSize);
        }}
        simple={isMobile}
      />
    </div>
  );

  return (
    <div className="space-y-3 md:space-y-4 pb-20 md:pb-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Typography.Title level={isMobile ? 5 : 4} className="!mb-1">
            招投标项目管理
          </Typography.Title>
          {!isMobile && (
            <Typography.Paragraph type="secondary" className="!mb-0">
              登记项目时填写参加单位并上传文件；同名参加单位自动分组，重复上传记为新版本
            </Typography.Paragraph>
          )}
        </div>
        {!isMobile && (
          <Space>
            {/* {biddingAccess.canReportPage && (
              <Button icon={<FileSearchOutlined />} onClick={() => navigate(ROUTE_PATHS.technicalReport)}>
                技术报告页
              </Button>
            )} */}
            {biddingAccess.canCreate && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>
                新建项目
              </Button>
            )}
          </Space>
        )}
      </div>

      <Card bodyStyle={isMobile ? { padding: 12 } : undefined}>
        {filterBar}

        {isMobile ? (
          <>
            <ProjectMobileCardList
              loading={loading}
              groups={items}
              onDetail={openDetail}
              onEdit={openEdit}
              onFeedback={openFeedback}
              onDelete={handleDelete}
              canDeleteGroup={isSuperAdmin}
              onDeleteGroup={handleDeleteGroup}
              onEditGroup={openEditGroup}
              onDownloadGroupTender={handleDownloadGroupTender}
              onAddProject={openCreate}
              onUploadRevision={(groupId, project, company) => openUploadRevision(groupId, project, company)}
              onDeleteCompany={handleDeleteCompany}
              onPreviewVersion={handlePreviewVersion}
              onDownloadVersion={handleDownloadVersion}
	              onDownloadVersionReport={handleDownloadVersionReport}
              onUploadVersionReport={handleUploadVersionReport}
              onAnalysisStatusChange={handleAnalysisStatusChange}
              onThirdPartySyncStatusChange={handleThirdPartySyncStatusChange}
              access={biddingAccess}
              isSuperAdmin={isSuperAdmin}
              onDeleteVersion={handleDeleteBidVersion}
            />
            {paginationNode}
          </>
        ) : (
          <>
            <ProjectHierarchyPanel
              loading={loading}
              groups={items}
              access={biddingAccess}
              isSuperAdmin={isSuperAdmin}
              canDeleteGroup={isSuperAdmin}
              onEditGroup={openEditGroup}
              onDeleteGroup={handleDeleteGroup}
              onDownloadGroupTender={handleDownloadGroupTender}
              onAddProject={openCreate}
              onEditProject={openEdit}
              onDeleteProject={handleDelete}
              onProjectDetail={openDetail}
              onUploadRevision={(groupId, project, company) => openUploadRevision(groupId, project, company)}
              onFeedback={openFeedback}
              onDeleteCompany={handleDeleteCompany}
              onPreviewVersion={handlePreviewVersion}
              onDownloadVersion={handleDownloadVersion}
              onDownloadVersionReport={handleDownloadVersionReport}
              onUploadVersionReport={handleUploadVersionReport}
              onAnalysisStatusChange={handleAnalysisStatusChange}
              onThirdPartySyncStatusChange={handleThirdPartySyncStatusChange}
              onDeleteVersion={handleDeleteBidVersion}
              onJsonUpload={openJsonUpload}
              onAnalyzeVersion={handleAnalyzeVersion}
              analyzingVersionIds={analyzingVersionIds}
              onRefresh={loadList}
            />
            {paginationNode}
          </>
        )}
      </Card>

      {isMobile && (
        <FloatButton
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openCreate()}
          tooltip="新建项目"
        />
      )}

      <ProjectFormModal
        open={formOpen}
        loading={submitting}
        project={activeProject}
        presetGroupId={presetGroupId}
        presetRevision={presetRevision}
        onCancel={() => {
          setFormOpen(false);
          setActiveProject(null);
          setPresetGroupId(null);
          setPresetRevision(null);
        }}
        onSubmit={handleFormSubmit}
      />

      <GroupFormModal
        open={groupFormOpen}
        loading={submitting}
        groupId={editingGroup?.id}
        groupName={editingGroup?.name}
        onCancel={() => {
          setGroupFormOpen(false);
          setEditingGroup(null);
        }}
        onSubmit={handleGroupFormSubmit}
      />

      <FeedbackModal
        open={feedbackOpen}
        loading={submitting}
        target={activeFeedbackTarget}
        onCancel={() => {
          setFeedbackOpen(false);
          setActiveFeedbackTarget(null);
        }}
        onSubmit={handleFeedbackSubmit}
      />

	      <ProjectDetailDrawer
        open={detailOpen}
        project={activeProject}
        onClose={() => {
          setDetailOpen(false);
          setActiveProject(null);
        }}
	      />

      <Modal
        title={`上传报告 JSON${jsonUploadTarget ? ` — v${jsonUploadTarget.version_number} · ${jsonUploadTarget.original_name}` : ""}`}
        open={jsonUploadOpen}
        onCancel={() => {
          if (!jsonUploadSubmitting) {
            setJsonUploadOpen(false);
            setJsonUploadTarget(null);
            setJsonUploadText("");
          }
        }}
        onOk={handleJsonUploadSubmit}
        okText="保存"
        cancelText="取消"
        confirmLoading={jsonUploadSubmitting}
        width={720}
        destroyOnClose
      >
        <Typography.Paragraph type="secondary" className="!mb-2 text-xs">
          粘贴符合报告数据格式的 JSON，保存后将覆盖该版本已有的报告数据。
        </Typography.Paragraph>
        <Input.TextArea
          rows={18}
          value={jsonUploadText}
          onChange={(e) => setJsonUploadText(e.target.value)}
          placeholder='{"report_title": "...", "project_info": {...}, ...}'
          style={{ fontFamily: "monospace", fontSize: 12 }}
        />
      </Modal>
	    </div>
  );
}
