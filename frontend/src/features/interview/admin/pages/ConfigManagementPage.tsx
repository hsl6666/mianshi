import { useEffect, useState } from "react";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Form, Input, Spin, Switch, Typography, message } from "antd";
import { fetchAdminInterviewConfig, updateAdminInterviewConfig } from "../../api";
import type { InterviewFlowConfig, InterviewFlowConfigUpdate } from "../../types";

const { TextArea } = Input;
const { Paragraph, Text, Title } = Typography;

export default function ConfigManagementPage() {
  const [form] = Form.useForm<InterviewFlowConfigUpdate>();
  const [config, setConfig] = useState<InterviewFlowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const oralEnabled = Form.useWatch("oral_enabled", form);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const next = await fetchAdminInterviewConfig();
      setConfig(next);
      form.setFieldsValue({
        oral_enabled: next.oral_enabled,
        assistant_system_prompt: next.assistant_system_prompt,
        assistant_user_prompt: next.assistant_user_prompt,
      });
    } catch {
      message.error("加载配置管理失败，请确认后端服务可用");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(nextValues?: InterviewFlowConfigUpdate) {
    setSaving(true);
    try {
      const values = nextValues || (await form.validateFields());
      const next = await updateAdminInterviewConfig(values);
      setConfig(next);
      form.setFieldsValue({
        oral_enabled: next.oral_enabled,
        assistant_system_prompt: next.assistant_system_prompt,
        assistant_user_prompt: next.assistant_user_prompt,
      });
      message.success("配置管理已保存");
    } catch {
      message.error("保存配置失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <Title level={3} className="!mb-2">
          配置管理
        </Title>
        <Paragraph className="!mb-0 text-stone-500">
          配置面试流程的全局开关，以及面试分析助手的系统提示词和附加用户提示词。
        </Paragraph>
      </div>

      <Card bordered={false} className="shadow-sm">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spin tip="加载配置中..." />
          </div>
        ) : (
          <Form form={form} layout="vertical" initialValues={{ oral_enabled: true, assistant_system_prompt: "", assistant_user_prompt: "" }}>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-stone-200 px-4 py-4">
                  <div>
                      <div className="text-base font-semibold text-stone-900">口试开启</div>
                      <Text type="secondary">
                      {oralEnabled
                        ? "当前面试流程包含口试环节。"
                        : "当前面试流程不包含口试环节，笔试完成后直接结束。"}
                      </Text>
                  </div>
                  <Form.Item name="oral_enabled" valuePropName="checked" className="!mb-0">
                    <Switch checkedChildren="开启" unCheckedChildren="关闭" />
                  </Form.Item>
                </div>

                <Form.Item
                  label="面试分析助手系统提示词"
                  name="assistant_system_prompt"
                  rules={[{ required: true, message: "请输入系统提示词" }]}
                  extra="作为系统角色发送，决定助手的身份、边界和回答风格。"
                >
                  <TextArea rows={10} placeholder="请输入系统提示词" />
                </Form.Item>

                <Form.Item
                  label="面试分析助手附加用户提示词"
                  name="assistant_user_prompt"
                  extra="会追加到每次分析请求里，适合放输出格式要求、分析重点、汇总维度等。"
                >
                  <TextArea rows={8} placeholder="例如：优先按岗位匹配度、项目复杂度、风险点分条输出；结论用 Markdown 小标题呈现。" />
                </Form.Item>

                <Flex gap={12}>
                  <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={() => void saveConfig()}>
                    保存配置
                  </Button>
                  <Button icon={<ReloadOutlined />} onClick={() => void loadConfig()} disabled={saving}>
                    重新加载
                  </Button>
                </Flex>
              </div>

              <aside className="space-y-4 rounded-lg border border-stone-200 bg-stone-50 p-4">
                <div>
                  <div className="text-sm font-semibold text-stone-900">当前生效</div>
                  <p className="mt-1 text-xs leading-5 text-stone-500">
                    提示词保存后会立即影响结果页“面试分析助手”的回答。
                  </p>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">口试环节</span>
                    <Text>{config?.oral_enabled ? "开启" : "关闭"}</Text>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">系统提示词</span>
                    <Text>{config?.assistant_system_prompt ? "已配置" : "未配置"}</Text>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-stone-500">附加用户提示词</span>
                    <Text>{config?.assistant_user_prompt ? "已配置" : "未配置"}</Text>
                  </div>
                </div>
              </aside>
            </div>
          </Form>
        )}
      </Card>
    </section>
  );
}
