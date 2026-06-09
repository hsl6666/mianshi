import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Menu } from "antd";
import type { MenuProps } from "antd";
import {
  DashboardOutlined,
  HistoryOutlined,
  ProjectOutlined,
  SafetyOutlined,
  UserOutlined,
  WalletOutlined,
} from "@ant-design/icons";
import { useIsMobile } from "@/hooks/useIsMobile";
import { ROUTE_PATHS } from "@/constants/common";
import { useAuthStore } from "@/store/authStore";

export default function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const permissions = useAuthStore((s) => s.permissions);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const hasPermission = useAuthStore((s) => s.hasPermission);

  const items: MenuProps["items"] = useMemo(() => {
    const menu: MenuProps["items"] = [];
    if (hasPermission("menus", "dashboard")) {
      menu.push({
        key: ROUTE_PATHS.dashboard,
        icon: <DashboardOutlined />,
        label: "Dashboard",
      });
    }
    if (hasPermission("menus", "bidding_projects")) {
      menu.push({
        key: ROUTE_PATHS.biddingProjects,
        icon: <ProjectOutlined />,
        label: "项目管理",
      });
    }
    if (hasPermission("menus", "recharge_console")) {
      menu.push({
        key: ROUTE_PATHS.rechargeConsole,
        icon: <WalletOutlined />,
        label: "充值控制台",
      });
    }
    if (hasPermission("menus", "users")) {
      menu.push({
        key: ROUTE_PATHS.users,
        icon: <UserOutlined />,
        label: "用户管理",
      });
    }
    if (hasPermission("menus", "operation_logs")) {
      menu.push({
        key: ROUTE_PATHS.operationLogs,
        icon: <HistoryOutlined />,
        label: "操作日志",
      });
    }
    if (hasPermission("menus", "permissions")) {
      menu.push({
        key: ROUTE_PATHS.permissions,
        icon: <SafetyOutlined />,
        label: "权限管理",
      });
    }
    return menu;
  }, [hasPermission, permissions, isSuperAdmin]);

  const selectedKey = useMemo(() => {
    if (
      location.pathname.startsWith(ROUTE_PATHS.dashboard) ||
      location.pathname.startsWith(ROUTE_PATHS.workbench)
    ) {
      return ROUTE_PATHS.dashboard;
    }
    if (location.pathname.startsWith(ROUTE_PATHS.rechargeConsole)) return ROUTE_PATHS.rechargeConsole;
    if (location.pathname.startsWith(ROUTE_PATHS.users)) return ROUTE_PATHS.users;
    if (location.pathname.startsWith(ROUTE_PATHS.operationLogs)) return ROUTE_PATHS.operationLogs;
    if (location.pathname.startsWith(ROUTE_PATHS.permissions)) return ROUTE_PATHS.permissions;
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
