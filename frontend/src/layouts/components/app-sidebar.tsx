import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import { HistoryOutlined, ProjectOutlined, UserOutlined } from "@ant-design/icons";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ROUTE_PATHS } from "@/constants/common";
import { useAuthStore } from "@/store/authStore";

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);

  const items: MenuProps["items"] = useMemo(() => {
    const menu: MenuProps["items"] = [
      {
        key: ROUTE_PATHS.biddingProjects,
        icon: <ProjectOutlined />,
        label: "项目管理",
      },
    ];
    if (isSuperAdmin) {
      menu.push(
        {
          key: ROUTE_PATHS.users,
          icon: <UserOutlined />,
          label: "用户管理",
        },
        {
          key: ROUTE_PATHS.operationLogs,
          icon: <HistoryOutlined />,
          label: "操作日志",
        },
      );
    }
    return menu;
  }, [isSuperAdmin]);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith(ROUTE_PATHS.users)) return ROUTE_PATHS.users;
    if (location.pathname.startsWith(ROUTE_PATHS.operationLogs)) return ROUTE_PATHS.operationLogs;
    return ROUTE_PATHS.biddingProjects;
  }, [location.pathname]);

  return (
    <Menu
      mode={isMobile ? "horizontal" : "inline"}
      selectedKeys={[selectedKey]}
      items={items}
      className={isMobile ? "min-w-max border-b-0" : "h-full border-r-0"}
      onClick={({ key }) => navigate(key)}
    />
  );
}
