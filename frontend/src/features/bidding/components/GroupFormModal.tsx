import { useEffect, useState } from "react";
import { DatePicker, Form, Input, Modal, Space, Spin, Typography, message } from "antd";
import type { Dayjs } from "dayjs";
import { FileOutlined } from "@ant-design/icons";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import { chinaNow, parseChinaTime } from "@/utils/date";
import { downloadGroupAttachment, fetchGroup } from "../api";
import { ATTACHMENT_TYPE_MAP } from "../constants";
import type { BiddingProjectGroupDetail, GroupFormValues } from "../types";

interface GroupFormModalProps {
  open: boolean;
  loading?: boolean;
  groupId?: number | null;
  groupName?: string;
  onCancel: () => void;
  onSubmit: (values: GroupFormValues) => Promise<void>;
}

interface FormFields {
  name: string;
  bid_opening_at?: Dayjs;
}

export default function GroupFormModal({
  open,
  loading,
  groupId,
  groupName,
  onCancel,
  onSubmit,
}: GroupFormModalProps) {
  const [form] = Form.useForm<FormFields>();
  const { isMobile, modalProps } = useResponsiveOverlay();
  const [detailLoading, setDetailLoading] = useState(false);
  const [groupDetail, setGroupDetail] = useState<BiddingProjectGroupDetail | null>(null);

  const tenderDoc = groupDetail?.attachments.find((a) => a.attachment_type === "tender_doc");

  useEffect(() => {
    if (!open || !groupId) {
      setGroupDetail(null);
      return;
    }
    setDetailLoading(true);
    fetchGroup(groupId)
      .then((detail) => {
        setGroupDetail(detail);
        form.setFieldsValue({
          name: detail.name,
          bid_opening_at: parseChinaTime(detail.bid_opening_at) ?? undefined,
        });
      })
      .catch(() => message.error("加载项目组详情失败"))
      .finally(() => setDetailLoading(false));
  }, [open, groupId, form]);

  const fillForm = () => {
    form.setFieldsValue({
      name: groupName ?? groupDetail?.name ?? "",
      bid_opening_at: groupDetail ? parseChinaTime(groupDetail.bid_opening_at) ?? undefined : undefined,
    });
  };

  const handleOk = async () => {
    const values = await form.validateFields();
    if (!groupId) return;
    await onSubmit({
      name: values.name,
      bid_opening_at: values.bid_opening_at!.toISOString(),
    });
  };

  const handleDownloadTender = async () => {
    if (!groupId || !tenderDoc) return;
    try {
      await downloadGroupAttachment({
        groupId,
        attachmentId: tenderDoc.id,
        filename: tenderDoc.original_name,
      });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "下载失败");
    }
  };

  return (
    <Modal
      title="编辑项目组"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={isMobile ? undefined : 520}
      destroyOnClose
      okText="保存"
      afterOpenChange={(visible) => {
        if (visible) fillForm();
      }}
      {...modalProps}
    >
      <Spin spinning={detailLoading}>
        <Form
          form={form}
          layout="vertical"
          preserve={false}
          key={groupId ? `group-${groupId}` : "group-new"}
        >
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: "请输入分组名称" }]}>
            <Input placeholder="例如：5月27号开标" maxLength={200} showCount />
          </Form.Item>
          <Form.Item label={ATTACHMENT_TYPE_MAP.tender_doc}>
            {tenderDoc ? (
              <Space>
                <FileOutlined className="text-blue-500" />
                <Typography.Link onClick={handleDownloadTender}>{tenderDoc.original_name}</Typography.Link>
                <Typography.Text type="secondary" className="text-xs">
                  （仅可查看，不可更换）
                </Typography.Text>
              </Space>
            ) : (
              <Typography.Text type="secondary">暂无招标文件</Typography.Text>
            )}
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
              defaultPickerValue={chinaNow()}
            />
          </Form.Item>
        </Form>
      </Spin>
    </Modal>
  );
}
