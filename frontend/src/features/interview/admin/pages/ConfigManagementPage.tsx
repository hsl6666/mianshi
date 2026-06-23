import { useEffect, useState } from "react";
import { Card, Flex, Spin, Switch, Typography, message } from "antd";
import { fetchAdminInterviewConfig, updateAdminInterviewConfig } from "../../api";
import type { InterviewFlowConfig } from "../../types";

const { Paragraph, Text, Title } = Typography;

export default function ConfigManagementPage() {
  const [config, setConfig] = useState<InterviewFlowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    try {
      const next = await fetchAdminInterviewConfig();
      setConfig(next);
    } catch {
      message.error("加载配置管理失败，请确认后端服务可用");
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(checked: boolean) {
    setSaving(true);
    try {
      const next = await updateAdminInterviewConfig({ oral_enabled: checked });
      setConfig(next);
      message.success(checked ? "已开启口试环节" : "已关闭口试环节");
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
          配置面试流程的全局开关。关闭口试后，候选人完成笔试会直接进入完成页。
        </Paragraph>
      </div>

      <Card bordered={false} className="shadow-sm">
        {loading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spin tip="加载配置中..." />
          </div>
        ) : (
          <Flex align="center" justify="space-between" gap={24}>
            <div>
              <div className="text-base font-semibold text-stone-900">口试开启</div>
              <Text type="secondary">
                {config?.oral_enabled
                  ? "当前面试流程包含口试环节。"
                  : "当前面试流程不包含口试环节，笔试完成后直接结束。"}
              </Text>
            </div>
            <Switch
              checked={config?.oral_enabled ?? true}
              loading={saving}
              onChange={(checked) => void handleToggle(checked)}
            />
          </Flex>
        )}
      </Card>
    </section>
  );
}
