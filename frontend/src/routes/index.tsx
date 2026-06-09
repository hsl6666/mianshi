import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { ProgressBar } from "@/components/ProgressBar";
import PermissionRoute from "@/components/PermissionRoute";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ROUTE_PATHS } from "@/constants/common";

const routes: RouteObject[] = [
  {
    path: ROUTE_PATHS.login,
    lazy: async () => ({
      Component: (await import("@/pages/Login")).default,
    }),
    HydrateFallback: ProgressBar,
  },
  {
    path: ROUTE_PATHS.technicalReport2,
    lazy: async () => {
      const { default: Page } = await import("@/features/bidding/components/TechnicalReportPage2");
      const Component = () => (
        <ProtectedRoute>
          <Page />
        </ProtectedRoute>
      );
      return { Component };
    },
    HydrateFallback: ProgressBar,
    handle: {
      title: "技术标评审修稿报告",
    },
  },
  {
    path: "/",
    lazy: async () => {
      const { default: Layout } = await import("@/layouts");
      const ProtectedLayout = () => (
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      );
      return { Component: ProtectedLayout };
    },
    HydrateFallback: ProgressBar,
    children: [
      {
        index: true,
        element: <Navigate replace to={ROUTE_PATHS.biddingProjects} />,
      },
      {
        path: ROUTE_PATHS.workbench.slice(1),
        element: <Navigate replace to={ROUTE_PATHS.dashboard} />,
      },
      {
        path: ROUTE_PATHS.dashboard.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/features/bidding/pages/WorkbenchPage");
          const Component = () => (
            <PermissionRoute module="menus" action="dashboard">
              <PermissionRoute module="bidding" action="view">
                <Page />
              </PermissionRoute>
            </PermissionRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: {
          title: "Dashboard",
        },
      },
      {
        path: ROUTE_PATHS.biddingProjects.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/features/bidding/pages/ProjectListPage");
          const Component = () => (
            <PermissionRoute module="menus" action="bidding_projects">
              <PermissionRoute module="bidding" action="view">
                <Page />
              </PermissionRoute>
            </PermissionRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: {
          title: "招投标项目",
        },
      },
      {
        path: ROUTE_PATHS.rechargeConsole.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/pages/RechargeConsole");
          const Component = () => (
            <PermissionRoute module="menus" action="recharge_console">
              <PermissionRoute module="users" action="view">
                <Page />
              </PermissionRoute>
            </PermissionRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: {
          title: "充值控制台",
        },
      },
      {
        path: ROUTE_PATHS.technicalReport.slice(1),
        lazy: async () => ({
          Component: (await import("@/features/bidding/components/TechnicalReportPage")).default,
        }),
        HydrateFallback: ProgressBar,
        handle: {
          title: "技术评审报告",
        },
      },
      {
        path: ROUTE_PATHS.users.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/pages/UserManagement");
          const Component = () => (
            <PermissionRoute module="menus" action="users">
              <PermissionRoute module="users" action="view">
                <Page />
              </PermissionRoute>
            </PermissionRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: { title: "用户管理" },
      },
      {
        path: ROUTE_PATHS.operationLogs.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/pages/OperationLogs");
          const Component = () => (
            <PermissionRoute module="menus" action="operation_logs">
              <PermissionRoute module="operation_logs" action="view">
                <Page />
              </PermissionRoute>
            </PermissionRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: { title: "操作日志" },
      },
      {
        path: ROUTE_PATHS.permissions.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/pages/PermissionManagement");
          const Component = () => (
            <PermissionRoute module="menus" action="permissions">
              <Page />
            </PermissionRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: { title: "权限管理" },
      },
    ],
  },
  {
    path: "*",
    element: <Navigate replace to="/" />,
  },
];

export const router = createBrowserRouter(routes, {
  basename: import.meta.env.VITE_APP_BASE_URL,
  future: {
    v7_relativeSplatPath: true,
    v7_fetcherPersist: true,
    v7_normalizeFormMethod: true,
    v7_partialHydration: true,
    v7_skipActionErrorRevalidation: true,
  },
});
