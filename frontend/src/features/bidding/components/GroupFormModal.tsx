import { useEffect } from "react";
import { Form, Input, Modal } from "antd";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import type { GroupFormValues } from "../types";

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

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue({ name: groupName ?? "" });
  }, [open, groupName, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    if (!groupId) return;
    await onSubmit({ name: values.name });
  };

  return (
    <Modal
      title="编辑项目组"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={isMobile ? undefined : 480}
      destroyOnClose
      okText="保存"
      {...modalProps}
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="name" label="分组名称" rules={[{ required: true, message: "请输入分组名称" }]}>
          <Input placeholder="例如：5月27号开标" maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  );
}
