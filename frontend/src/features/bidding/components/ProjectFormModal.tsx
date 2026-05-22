import { useEffect } from "react";
import { DatePicker, Form, Input, Modal, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import dayjs, { type Dayjs } from "dayjs";
import { InboxOutlined } from "@ant-design/icons";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import { ACCEPTED_FILE_TYPES, ATTACHMENT_TYPE_MAP } from "../constants";
import { getAttachmentDownloadUrl } from "../api";
import type { BiddingProjectDetail, ProjectFormValues } from "../types";

interface ProjectFormModalProps {
  open: boolean;
  loading?: boolean;
  project?: BiddingProjectDetail | null;
  onCancel: () => void;
  onSubmit: (values: ProjectFormValues) => Promise<void>;
}

interface FormFields {
  name: string;
  participating_units: string;
  bid_opening_at: Dayjs;
  tender_doc?: UploadFile[];
  bid_doc?: UploadFile[];
}

export default function ProjectFormModal({
  open,
  loading,
  project,
  onCancel,
  onSubmit,
}: ProjectFormModalProps) {
  const [form] = Form.useForm<FormFields>();
  const { isMobile, modalProps } = useResponsiveOverlay();
  const isEdit = Boolean(project);

  useEffect(() => {
    if (!open) return;
    if (project) {
      form.setFieldsValue({
        name: project.name,
        participating_units: project.participating_units,
        bid_opening_at: dayjs(project.bid_opening_at),
        tender_doc: [],
        bid_doc: [],
      });
    } else {
      form.resetFields();
    }
  }, [open, project, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const tenderFile = values.tender_doc?.[0]?.originFileObj as File | undefined;
    const bidFile = values.bid_doc?.[0]?.originFileObj as File | undefined;

    if (!isEdit && !tenderFile) {
      message.warning("请上传招标文件");
      return;
    }
    if (!isEdit && !bidFile) {
      message.warning("请上传投标文件");
      return;
    }

    await onSubmit({
      name: values.name,
      participating_units: values.participating_units,
      bid_opening_at: values.bid_opening_at.toISOString(),
      tender_doc: tenderFile,
      bid_doc: bidFile,
    });
  };

  const renderExistingFile = (type: "tender_doc" | "bid_doc") => {
    if (!project) return null;
    const file = project.attachments.find((item) => item.attachment_type === type);
    if (!file) return null;
    return (
      <Typography.Text type="secondary" className="block mb-2 text-xs">
        当前文件：
        <a
          className="ml-1"
          href={getAttachmentDownloadUrl(project.id, file.id)}
          target="_blank"
          rel="noreferrer"
        >
          {file.original_name}
        </a>
        （重新上传将替换）
      </Typography.Text>
    );
  };

  return (
    <Modal
      title={isEdit ? "编辑项目（第一步）" : "新建项目（第一步）"}
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={isMobile ? undefined : 720}
      destroyOnClose
      okText="保存"
      {...modalProps}
    >
      <p className="text-gray-500 mb-4 text-sm">
        登记招投标项目基础信息，上传招标文件与投标文件。开标时间到达后，项目将进入「待反馈」状态。
      </p>
      <Form form={form} layout="vertical" preserve={false}>
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
          <DatePicker showTime className="w-full" format="YYYY-MM-DD HH:mm" />
        </Form.Item>
        <Form.Item
          name="tender_doc"
          label={ATTACHMENT_TYPE_MAP.tender_doc}
          valuePropName="fileList"
          getValueFromEvent={(e) => (Array.isArray(e) ? e : e?.fileList)}
          rules={isEdit ? [] : [{ required: true, message: "请上传招标文件" }]}
        >
          {renderExistingFile("tender_doc")}
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
          rules={isEdit ? [] : [{ required: true, message: "请上传投标文件" }]}
        >
          {renderExistingFile("bid_doc")}
          <Upload.Dragger maxCount={1} beforeUpload={() => false} accept={ACCEPTED_FILE_TYPES}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">上传投标文件</p>
            <p className="ant-upload-hint">支持 PDF、Word、Excel、压缩包，最大 50MB</p>
          </Upload.Dragger>
        </Form.Item>
      </Form>
    </Modal>
  );
}
