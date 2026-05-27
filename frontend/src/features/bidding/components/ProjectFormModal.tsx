import { useEffect, useState } from "react";
import { DatePicker, Divider, Form, Input, Modal, Radio, Select, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import type { Dayjs } from "dayjs";
import { FolderOutlined, InboxOutlined } from "@ant-design/icons";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import { chinaNow, formatChinaTime } from "@/utils/date";
import { ACCEPTED_FILE_TYPES, ATTACHMENT_TYPE_MAP } from "../constants";
import SelectOrInput from "./SelectOrInput";
import { fetchGroups, fetchProjectFormOptions } from "../api";
import type {
  BiddingProjectDetail,
  BiddingProjectGroupListItem,
  ProjectFormOptions,
  ProjectFormValues,
  ProjectRevisionPreset,
} from "../types";

interface ProjectFormModalProps {
  open: boolean;
  loading?: boolean;
  project?: BiddingProjectDetail | null;
  presetGroupId?: number | null;
  presetRevision?: ProjectRevisionPreset | null;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
}

interface FormFields {
  group_mode: "existing" | "new";
  group_id?: number;
  group_name?: string;
  group_bid_opening_at?: Dayjs;
  name?: string;
  participating_units?: string;
  tender_doc?: UploadFile[];
  bid_doc?: UploadFile[];
}

export default function ProjectFormModal({
  open,
  loading,
  project,
  presetGroupId,
  presetRevision,
  onCancel,
  onSubmit,
}: ProjectFormModalProps) {
  const [form] = Form.useForm<FormFields>();
  const { isMobile, modalProps } = useResponsiveOverlay();
  const isEdit = Boolean(project);
  const isRevision = Boolean(presetRevision);
  const isGroupOnly = !isEdit && !presetGroupId && !isRevision;
  const [groups, setGroups] = useState<BiddingProjectGroupListItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [formOptions, setFormOptions] = useState<ProjectFormOptions>({
    project_names: [],
    company_names: [],
  });
  const [optionsLoading, setOptionsLoading] = useState(false);
  const useSelectOrInput = !isEdit && !isRevision;

  const groupMode = Form.useWatch("group_mode", form);
  const watchedGroupId = Form.useWatch("group_id", form);
  const effectiveGroupId = presetGroupId ?? presetRevision?.groupId ?? watchedGroupId;
  const isCreatingNewGroup = isGroupOnly && groupMode === "new";
  const showProjectFields =
    isEdit || Boolean(presetGroupId) || isRevision || (isGroupOnly && groupMode === "existing");
  const usingExistingGroup = Boolean(presetGroupId || presetRevision || groupMode === "existing");
  const requireBidOnCreate = showProjectFields && !isEdit;

  useEffect(() => {
    if (!open || isEdit || isRevision) return;
    setGroupsLoading(true);
    fetchGroups()
      .then(setGroups)
      .catch(() => message.error("加载项目组列表失败"))
      .finally(() => setGroupsLoading(false));
  }, [open, isEdit, isRevision]);

  useEffect(() => {
    if (!open || !useSelectOrInput) return;

    if (!effectiveGroupId) {
      setFormOptions({ project_names: [], company_names: [] });
      return;
    }

    setOptionsLoading(true);
    fetchProjectFormOptions(effectiveGroupId)
      .then(setFormOptions)
      .catch(() => message.error("加载项目组选项失败"))
      .finally(() => setOptionsLoading(false));
  }, [open, useSelectOrInput, effectiveGroupId]);

  useEffect(() => {
    if (!open || !useSelectOrInput || isRevision || presetGroupId) return;
    form.setFieldsValue({ name: undefined, participating_units: undefined });
  }, [open, useSelectOrInput, isRevision, presetGroupId, effectiveGroupId, form]);

  const fillForm = () => {
    if (project) {
      form.setFieldsValue({
        name: project.name,
        participating_units: project.participating_units,
      });
      return;
    }
    if (presetRevision) {
      form.resetFields();
      form.setFieldsValue({
        group_mode: "existing",
        group_id: presetRevision.groupId,
        name: presetRevision.projectName,
        participating_units: presetRevision.companyName,
        tender_doc: [],
        bid_doc: [],
      });
      return;
    }
    form.resetFields();
    form.setFieldsValue({
      group_mode: presetGroupId ? "existing" : "new",
      group_id: presetGroupId ?? undefined,
      group_bid_opening_at: undefined,
      tender_doc: [],
      bid_doc: [],
    });
  };

  const handleOk = async () => {
    const values = await form.validateFields();

    const resolvedGroupId = values.group_id ?? presetGroupId ?? presetRevision?.groupId ?? undefined;
    const resolvedGroupMode: FormFields["group_mode"] = isEdit
      ? "existing"
      : presetGroupId || presetRevision
        ? "existing"
        : values.group_mode ?? "new";

    if (!isEdit && resolvedGroupMode === "existing" && !resolvedGroupId) {
      message.warning("请选择项目组");
      return;
    }

    const tenderFile = values.tender_doc?.[0]?.originFileObj as File | undefined;
    const bidFile = values.bid_doc?.[0]?.originFileObj as File | undefined;

    if (isCreatingNewGroup) {
      if (!values.group_name?.trim()) {
        message.warning("请输入分组名称");
        return;
      }
      if (!values.group_bid_opening_at) {
        message.warning("请选择开标时间");
        return;
      }
      if (!tenderFile) {
        message.warning("请上传招标文件");
        return;
      }
      await onSubmit({
        group_mode: "new",
        group_name: values.group_name.trim(),
        group_bid_opening_at: values.group_bid_opening_at.toISOString(),
        tender_doc: tenderFile,
      });
      return;
    }

    if (!isEdit && resolvedGroupMode === "new" && !values.group_name?.trim()) {
      message.warning("请输入分组名称");
      return;
    }

    if (!values.name?.trim() || !values.participating_units?.trim()) {
      message.warning("请填写完整项目信息");
      return;
    }

    if (requireBidOnCreate && !bidFile) {
      message.warning("请上传投标文件");
      return;
    }
    if (isRevision && !bidFile) {
      message.warning("请上传新版投标文件");
      return;
    }

    await onSubmit({
      group_mode: resolvedGroupMode,
      group_id: resolvedGroupId,
      group_name: values.group_name,
      name: values.name.trim(),
      participating_units: values.participating_units.trim(),
      tender_doc: tenderFile,
      bid_doc: bidFile,
    });
  };

  const modalTitle = isEdit
    ? "编辑项目"
    : isRevision
      ? "上传新版投标文件"
      : presetGroupId
        ? "向项目组添加项目"
        : groupMode === "new"
          ? "新建项目组"
          : "新建项目";

  const lockProjectMeta = isRevision;

  return (
    <Modal
      title={modalTitle}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={isMobile ? undefined : 720}
      destroyOnClose
      okText="保存"
      afterOpenChange={(visible) => {
        if (visible) {
          requestAnimationFrame(() => fillForm());
        }
      }}
      {...modalProps}
    >
      <p className="text-gray-500 mb-4 text-sm">
        {isEdit
          ? "可修改项目名称、参加单位。开标时间请在项目组编辑中修改。"
          : isRevision
            ? "同一项目、同一参加单位再次上传时，将自动归入该单位并记录为新版本。"
            : isCreatingNewGroup
              ? "填写分组名称、开标时间并上传招标文件；项目可在组内通过「添加项目」登记。"
              : showProjectFields
                ? usingExistingGroup
                  ? "选择已有项目组时无需重复上传招标文件；同名参加单位将自动追加投标文件版本。"
                  : "请填写项目信息并上传投标文件。"
                : "请填写项目组与项目信息。"}
      </p>
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        key={
          project
            ? `project-${project.id}`
            : presetRevision
              ? `revision-${presetRevision.groupId}-${presetRevision.projectName}-${presetRevision.companyName}`
              : presetGroupId
                ? `preset-${presetGroupId}`
                : "project-new"
        }
      >
        {isGroupOnly && (
          <>
            <Form.Item name="group_mode" label="项目组" initialValue="new">
              <Radio.Group>
                <Radio value="new">新建项目组</Radio>
                <Radio value="existing">选择已有项目组</Radio>
              </Radio.Group>
            </Form.Item>

            {groupMode === "new" ? (
              <>
                <Form.Item
                  name="group_name"
                  label="分组名称"
                  rules={[{ required: true, message: "请输入分组名称" }]}
                >
                  <Input placeholder="例如：5月27号开标" maxLength={200} showCount />
                </Form.Item>
                <Form.Item
                  name="tender_doc"
                  label={ATTACHMENT_TYPE_MAP.tender_doc}
                  valuePropName="fileList"
                  getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                  rules={[{ required: true, message: "请上传招标文件" }]}
                >
                  <Upload.Dragger maxCount={1} beforeUpload={() => false} accept={ACCEPTED_FILE_TYPES}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">上传招标文件</p>
                    <p className="ant-upload-hint">支持 PDF、Word、Excel、压缩包，最大 50MB</p>
                  </Upload.Dragger>
                </Form.Item>
                <Form.Item
                  name="group_bid_opening_at"
                  label="开标时间"
                  rules={[{ required: true, message: "请选择开标时间" }]}
                >
                  <DatePicker
                    showTime
                    className="w-full"
                    format="YYYY-MM-DD HH:mm"
                    placeholder="请选择开标时间"
                    defaultPickerValue={chinaNow()}
                  />
                </Form.Item>
              </>
            ) : (
              <Form.Item
                name="group_id"
                label="选择项目组"
                rules={[{ required: true, message: "请选择项目组" }]}
              >
                <Select
                  placeholder="选择项目组"
                  loading={groupsLoading}
                  showSearch
                  optionFilterProp="label"
                  options={groups.map((g) => ({
                    value: g.id,
                    label: `${g.name}（${formatChinaTime(g.bid_opening_at, "YYYY-MM-DD HH:mm")}，${g.project_count} 个项目）`,
                  }))}
                />
              </Form.Item>
            )}
          </>
        )}

        {(presetGroupId || presetRevision) && !isEdit && (
          <>
            <Form.Item name="group_mode" hidden initialValue="existing">
              <Input />
            </Form.Item>
            <Form.Item name="group_id" hidden initialValue={presetGroupId ?? presetRevision?.groupId}>
              <Input />
            </Form.Item>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <FolderOutlined />
              <span>{isRevision ? "向已有项目追加投标文件版本" : "将添加到已有项目组"}</span>
            </div>
          </>
        )}

        {isEdit && project && (
          <div className="mb-4 text-sm text-gray-500">
            所属项目组：<Typography.Text strong>{project.group_name}</Typography.Text>
          </div>
        )}

        {showProjectFields && (
          <>
            {isGroupOnly && groupMode === "existing" && <Divider />}
            <Form.Item
              name="name"
              label="项目名称"
              rules={[{ required: true, message: useSelectOrInput ? "请选择或输入项目名称" : "请输入项目名称" }]}
            >
              {useSelectOrInput ? (
                <SelectOrInput
                  options={formOptions.project_names}
                  loading={optionsLoading}
                  selectPlaceholder={
                    effectiveGroupId ? "选择本组已有项目名称" : "请先选择项目组"
                  }
                  inputPlaceholder="例如：XX 市政道路改造工程"
                  disabled={lockProjectMeta || !effectiveGroupId}
                />
              ) : (
                <Input
                  placeholder="例如：XX 市政道路改造工程"
                  maxLength={200}
                  showCount
                  disabled={lockProjectMeta}
                />
              )}
            </Form.Item>
            <Form.Item
              name="participating_units"
              label="参加单位"
              rules={[{ required: true, message: useSelectOrInput ? "请选择或输入参加单位" : "请输入参加单位" }]}
            >
              {useSelectOrInput ? (
                <SelectOrInput
                  options={formOptions.company_names}
                  loading={optionsLoading}
                  selectPlaceholder={
                    effectiveGroupId ? "选择本组已有参加单位" : "请先选择项目组"
                  }
                  inputPlaceholder="例如：XX建设有限公司"
                  disabled={lockProjectMeta || !effectiveGroupId}
                />
              ) : (
                <Input
                  placeholder="例如：XX建设有限公司"
                  maxLength={200}
                  showCount
                  disabled={lockProjectMeta}
                />
              )}
            </Form.Item>
            {!isEdit && (
              <Form.Item
                name="bid_doc"
                label={isRevision ? "新版投标文件" : ATTACHMENT_TYPE_MAP.bid_doc}
                valuePropName="fileList"
                getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                rules={[{ required: true, message: "请上传投标文件" }]}
              >
                <Upload.Dragger maxCount={1} beforeUpload={() => false} accept={ACCEPTED_FILE_TYPES}>
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">{isRevision ? "上传新版投标文件" : "上传投标文件"}</p>
                  <p className="ant-upload-hint">支持 PDF、Word、Excel、压缩包，最大 50MB</p>
                </Upload.Dragger>
              </Form.Item>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}
