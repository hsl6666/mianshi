import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { login } from "@/api/auth";
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

  const handleSubmit = async (values: LoginForm) => {
    setLoading(true);
    try {
      const data = await login(values.username.trim(), values.password);
      authLogin(data.access_token, data.refresh_token, data.username, data.role);
      message.success("登录成功");
      navigate(from || ROUTE_PATHS.biddingProjects, { replace: true });
    } catch (error) {
      message.error(error instanceof Error ? error.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4">
      <Card className="w-full max-w-md shadow-md" bordered={false}>
        <Typography.Title level={3} className="!mb-1 text-center">
          招投标项目管理
        </Typography.Title>
        <Typography.Paragraph type="secondary" className="text-center !mb-6">
          请登录后使用系统
        </Typography.Paragraph>
        <Form layout="vertical" size="large" onFinish={handleSubmit}>
          <Form.Item name="username" rules={[{ required: true, message: "请输入用户名" }]}>
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
  );
}
