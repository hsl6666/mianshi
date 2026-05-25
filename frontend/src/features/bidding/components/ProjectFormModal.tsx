import { useEffect, useState } from "react";
import { DatePicker, Divider, Form, Input, Modal, Radio, Select, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import dayjs, { type Dayjs } from "dayjs";
import { FolderOutlined, InboxOutlined } from "@ant-design/icons";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import { ACCEPTED_FILE_TYPES, ATTACHMENT_TYPE_MAP } from "../constants";
import { fetchGroups } from "../api";
import type {
  BiddingProjectDetail,
  BiddingProjectGroupListItem,
  ProjectFormValues,
} from "../types";

interface ProjectFormModalProps {
  open: boolean;
  loading?: boolean;
  project?: BiddingProjectDetail | null;
  presetGroupId?: number | null;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
}

interface FormFields {
  group_mode: "existing" | "new";
  group_id?: number;
  group_name?: string;
  name?: string;
  participating_units?: string;
  bid_opening_at?: Dayjs;
  tender_doc?: UploadFile[];
  bid_doc?: UploadFile[];
}

export default function ProjectFormModal({
  open,
  loading,
  project,
  presetGroupId,
  onCancel,
  onSubmit,
}: ProjectFormModalProps) {
  const [form] = Form.useForm<FormFields>();
  const { isMobile, modalProps } = useResponsiveOverlay();
  const isEdit = Boolean(project);
  const isGroupOnly = !isEdit && !presetGroupId;
  const [groups, setGroups] = useState<BiddingProjectGroupListItem[]>([]);
  const [groupsLoading, setGroupsLoading] = useState(false);

  const groupMode = Form.useWatch("group_mode", form);
  const showProjectFields = isEdit || Boolean(presetGroupId) || groupMode === "existing";
  const requireProjectFiles = showProjectFields && !isEdit;

  useEffect(() => {
    if (!open || isEdit) return;
    setGroupsLoading(true);
    fetchGroups()
      .then(setGroups)
      .catch(() => message.error("加载项目组列表失败"))
      .finally(() => setGroupsLoading(false));
  }, [open, isEdit]);

  const fillForm = () => {
    if (project) {
      form.setFieldsValue({
        name: project.name,
        participating_units: project.participating_units,
        bid_opening_at: dayjs(project.bid_opening_at),
      });
      return;
    }
    form.resetFields();
    form.setFieldsValue({
      group_mode: presetGroupId ? "existing" : "new",
      group_id: presetGroupId ?? undefined,
      bid_opening_at: undefined,
      tender_doc: [],
      bid_doc: [],
    });
  };

  const handleOk = async () => {
    const values = await form.validateFields();

    if (isGroupOnly && values.group_mode === "new") {
      if (!values.group_name?.trim()) {
        message.warning("请输入分组名称");
        return;
      }
      await onSubmit({
        group_mode: "new",
        group_name: values.group_name.trim(),
      });
      return;
    }

    const resolvedGroupId = values.group_id ?? presetGroupId ?? undefined;
    const resolvedGroupMode: FormFields["group_mode"] = isEdit
      ? "existing"
      : presetGroupId
        ? "existing"
        : values.group_mode ?? "new";

    if (!isEdit && resolvedGroupMode === "existing" && !resolvedGroupId) {
      message.warning("请选择项目组");
      return;
    }

    if (!values.name?.trim() || !values.participating_units?.trim() || !values.bid_opening_at) {
      message.warning("请填写完整项目信息");
      return;
    }

    const tenderFile = values.tender_doc?.[0]?.originFileObj as File | undefined;
    const bidFile = values.bid_doc?.[0]?.originFileObj as File | undefined;
    if (requireProjectFiles) {
      if (!tenderFile) {
        message.warning("请上传招标文件");
        return;
      }
      if (!bidFile) {
        message.warning("请上传投标文件");
        return;
      }
    }

    await onSubmit({
      group_mode: resolvedGroupMode,
      group_id: resolvedGroupId,
      group_name: values.group_name,
      name: values.name.trim(),
      participating_units: values.participating_units.trim(),
      bid_opening_at: values.bid_opening_at.toISOString(),
      tender_doc: tenderFile,
      bid_doc: bidFile,
    });
  };

  const modalTitle = isEdit
    ? "编辑项目"
    : presetGroupId
      ? "向项目组添加项目"
      : groupMode === "new"
        ? "新建项目组"
        : "新建项目";

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
          ? "可修改项目名称、参加单位、开标时间等全部项目字段。"
          : showProjectFields
            ? "选择已有项目组后，填写项目信息并上传招标文件、投标文件。"
            : "仅需填写分组名称，保存后可在项目组下点击「添加项目」登记具体项目。"}
      </p>
      <Form
        form={form}
        layout="vertical"
        preserve={false}
        key={
          project ? `project-${project.id}` : presetGroupId ? `preset-${presetGroupId}` : "project-new"
        }
        initialValues={
          project
            ? {
                name: project.name,
                participating_units: project.participating_units,
                bid_opening_at: dayjs(project.bid_opening_at),
              }
            : {
                group_mode: presetGroupId ? "existing" : "new",
                group_id: presetGroupId ?? undefined,
                tender_doc: [],
                bid_doc: [],
              }
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
              <Form.Item
                name="group_name"
                label="分组名称"
                rules={[{ required: true, message: "请输入分组名称" }]}
              >
                <Input placeholder="例如：5月27号开标" maxLength={200} showCount />
              </Form.Item>
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
                    label: `${g.name}（${dayjs(g.bid_opening_at).format("YYYY-MM-DD HH:mm")}，${g.project_count} 个项目）`,
                  }))}
                />
              </Form.Item>
            )}
          </>
        )}

        {!isEdit && presetGroupId && (
          <>
            <Form.Item name="group_mode" hidden initialValue="existing">
              <Input />
            </Form.Item>
            <Form.Item name="group_id" hidden initialValue={presetGroupId}>
              <Input />
            </Form.Item>
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
              <FolderOutlined />
              <span>将添加到已有项目组</span>
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
            <Form.Item name="name" label="项目名称" rules={[{ required: true, message: "请输入项目名称" }]}>
              <Input placeholder="例如：XX 市政道路改造工程" maxLength={200} showCount />
            </Form.Item>
            <Form.Item
              name="participating_units"
              label="参加单位"
              rules={[{ required: true, message: "请输入参加单位" }]}
            >
              <Input placeholder="例如：XX建设有限公司" maxLength={200} showCount />
            </Form.Item>
            <Form.Item
              name="bid_opening_at"
              label="开标时间"
              rules={[{ required: true, message: "请选择开标时间" }]}
            >
              <DatePicker
                showTime
                className="w-full"
                format="YYYY-MM-DD HH:mm"
                placeholder="请选择开标时间"
                defaultPickerValue={dayjs()}
              />
            </Form.Item>
            {requireProjectFiles && (
              <>
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
                  name="bid_doc"
                  label={ATTACHMENT_TYPE_MAP.bid_doc}
                  valuePropName="fileList"
                  getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
                  rules={[{ required: true, message: "请上传投标文件" }]}
                >
                  <Upload.Dragger maxCount={1} beforeUpload={() => false} accept={ACCEPTED_FILE_TYPES}>
                    <p className="ant-upload-drag-icon">
                      <InboxOutlined />
                    </p>
                    <p className="ant-upload-text">上传投标文件</p>
                    <p className="ant-upload-hint">支持 PDF、Word、Excel、压缩包，最大 50MB</p>
                  </Upload.Dragger>
                </Form.Item>
              </>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}
