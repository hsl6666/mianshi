import { useEffect, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RobotOutlined,
  SolutionOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Button, Layout, Menu, Space, theme, type MenuProps } from "antd";
import { ROUTE_PATHS } from "@/constants/common";

const { Header, Sider, Content } = Layout;

const menuItems: MenuProps["items"] = [
  { key: ROUTE_PATHS.adminTalents, icon: <UserOutlined />, label: "人才管理" },
  { key: ROUTE_PATHS.adminPositions, icon: <SolutionOutlined />, label: "岗位管理" },
  { key: ROUTE_PATHS.adminQuestions, icon: <FileTextOutlined />, label: "笔试管理" },
  { key: ROUTE_PATHS.adminModels, icon: <RobotOutlined />, label: "模型管理" },
];

const menuKeys = [
  ROUTE_PATHS.adminTalents,
  ROUTE_PATHS.adminPositions,
  ROUTE_PATHS.adminQuestions,
  ROUTE_PATHS.adminModels,
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken();

  const selectedKey = menuKeys.includes(location.pathname) ? location.pathname : ROUTE_PATHS.adminTalents;

  useEffect(() => {
    const root = document.getElementById("root");
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    const prevRootHeight = root?.style.height ?? "";
    const prevRootOverflow = root?.style.overflow ?? "";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    if (root) {
      root.style.height = "100%";
      root.style.overflow = "hidden";
    }
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
      if (root) {
        root.style.height = prevRootHeight;
        root.style.overflow = prevRootOverflow;
      }
    };
  }, []);

  return (
    <Layout className="h-screen overflow-hidden">
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div
          className={`flex h-16 shrink-0 items-center justify-center font-semibold text-white transition-all ${
            collapsed ? "px-2 text-xs" : "px-4 text-sm"
          }`}
        >
          {collapsed ? "后台" : "AI 面试后台"}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Header
          style={{ padding: "0 16px", background: colorBgContainer }}
          className="flex h-16 shrink-0 items-center justify-between"
        >
          <Space>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 64, height: 64 }}
            />
            <span className="text-base font-semibold text-stone-900">AI 面试管理后台</span>
          </Space>
          <Link className="text-sm text-emerald-800 hover:text-emerald-950" to={ROUTE_PATHS.interviewBasic}>
            返回面试端
          </Link>
        </Header>
        <Content
          className="!m-4 min-h-0 flex-1 overflow-y-auto"
          style={{
            padding: 24,
            background: colorBgContainer,
            borderRadius: borderRadiusLG,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
