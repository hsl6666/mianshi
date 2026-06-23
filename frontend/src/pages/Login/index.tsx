import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { login } from "@/api/auth";
import { wangjunLogin } from "@/api/wangjun";
import { isWangjunLoginEnabled } from "@/utils/wangjunAuth";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { ROUTE_PATHS } from "@/constants/common";
import { useAuthStore } from "@/store/authStore";

interface LoginForm {
  username: string;
  password: string;
}

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLogin = useAuthStore((s) => s.login);
  const hydrateProfile = useAuthStore((s) => s.hydrateProfile);
  const updateWangjunAuth = useAuthStore((s) => s.updateWangjunAuth);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(ROUTE_PATHS.biddingProjects, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const from =
    (location.state as { from?: string } | null)?.from && (location.state as { from?: string }).from !== ROUTE_PATHS.login
      ? (location.state as { from?: string }).from
      : ROUTE_PATHS.biddingProjects;

  const syncWangjunLoginInBackground = (username: string, password: string) => {
    void wangjunLogin(username, password)
      .then((wangjunAuth) => {
        if (wangjunAuth) {
          updateWangjunAuth(wangjunAuth);
        }
      })
      .catch(() => undefined);
  };

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      const username = values.username.trim();
      const data = await login(username, values.password);

      authLogin(data.access_token, data.refresh_token, data.username, data.role, null);
      await hydrateProfile();
      message.success("登录成功");
      navigate(from || ROUTE_PATHS.biddingProjects, { replace: true });

      if (isWangjunLoginEnabled()) {
        syncWangjunLoginInBackground(username, values.password);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-x-hidden bg-gradient-to-br from-slate-50 to-blue-50 px-4 dark:from-slate-900 dark:to-slate-800">
      <div className="absolute right-4 top-4 z-10">
        <ThemeSwitch className="!text-slate-600 dark:!text-slate-200" />
      </div>
      <div className="w-full max-w-md min-w-0">
        <Card className="w-full shadow-md" bordered={false}>
          <Typography.Title level={3} className="!mb-1 text-center">
            招投标项目管理
          </Typography.Title>
          <Typography.Paragraph type="secondary" className="text-center !mb-6">
            请登录后使用系统
          </Typography.Paragraph>
          <Form layout="vertical" size="large" onFinish={handleSubmit}>
            <Form.Item name="username" rules={[{ required: true, whitespace: true, message: "请输入用户名" }]}>
              <Input prefix={<UserOutlined />} placeholder="用户名" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: "请输入密码" }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="密码" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
