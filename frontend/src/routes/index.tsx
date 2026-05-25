import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { ProgressBar } from "@/components/ProgressBar";
import AdminRoute from "@/components/AdminRoute";
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
        path: ROUTE_PATHS.biddingProjects.slice(1),
        lazy: async () => ({
          Component: (await import("@/features/bidding/pages/ProjectListPage")).default,
        }),
        HydrateFallback: ProgressBar,
        handle: {
          title: "招投标项目",
        },
      },
      {
        path: ROUTE_PATHS.users.slice(1),
        lazy: async () => {
          const { default: Page } = await import("@/pages/UserManagement");
          const Component = () => (
            <AdminRoute>
              <Page />
            </AdminRoute>
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
            <AdminRoute>
              <Page />
            </AdminRoute>
          );
          return { Component };
        },
        HydrateFallback: ProgressBar,
        handle: { title: "操作日志" },
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
