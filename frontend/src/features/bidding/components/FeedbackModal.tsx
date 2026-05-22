import { useEffect } from "react";
import { Form, Input, InputNumber, Modal } from "antd";
import { useResponsiveOverlay } from "@/hooks/useResponsiveOverlay";
import type { BiddingProjectDetail, FeedbackFormValues } from "../types";

interface FeedbackModalProps {
  open: boolean;
  loading?: boolean;
  project: BiddingProjectDetail | null;
  onCancel: () => void;
  onSubmit: (values: FeedbackFormValues) => Promise<void>;
}

export default function FeedbackModal({ open, loading, project, onCancel, onSubmit }: FeedbackModalProps) {
  const [form] = Form.useForm<FeedbackFormValues>();
  const { isMobile, modalProps } = useResponsiveOverlay();

  useEffect(() => {
    if (!open || !project) return;
    if (project.feedback) {
      form.setFieldsValue({
        final_score: project.feedback.final_score,
        ranking: project.feedback.ranking ?? undefined,
        score_detail: project.feedback.score_detail ?? undefined,
        remark: project.feedback.remark ?? undefined,
      });
    } else {
      form.resetFields();
    }
  }, [open, project, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    await onSubmit(values);
  };

  return (
    <Modal
      title="评审结果反馈（第二步）"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={loading}
      width={isMobile ? undefined : 640}
      destroyOnClose
      okText="提交反馈"
      {...modalProps}
    >
      <p className="text-gray-500 mb-4 text-sm">
        项目「{project?.name}」开标后，请录入最终打分与排名情况，便于后续复盘与案例沉淀。
      </p>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="final_score"
          label="最终得分"
          rules={[{ required: true, message: "请输入最终得分" }]}
        >
          <InputNumber min={0} max={100} precision={2} className="w-full" placeholder="0 - 100" />
        </Form.Item>
        <Form.Item name="ranking" label="排名">
          <InputNumber min={1} precision={0} className="w-full" placeholder="可选，如：1 表示第一名" />
        </Form.Item>
        <Form.Item name="score_detail" label="打分明细">
          <Input.TextArea rows={4} placeholder="可填写技术分、商务分、价格分等明细" />
        </Form.Item>
        <Form.Item name="remark" label="备注说明">
          <Input.TextArea rows={3} placeholder="中标情况、失分原因、改进建议等" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
