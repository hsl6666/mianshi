import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { ProgressBar } from "@/components/ProgressBar";
import { echartsDemoRoute } from "./echarts-demo";
import { landingRoute } from "./landing";
import { ROUTE_PATHS } from "@/constants/common";

const routes: RouteObject[] = [
  {
    path: "/",
    lazy: async () => ({
      Component: (await import("@/layouts")).default,
    }),
    HydrateFallback: ProgressBar,
    children: [
      {
        index: true,
        element: <Navigate replace to={ROUTE_PATHS.landing} />,
      },
      landingRoute,
      echartsDemoRoute,
    ],
  },
  {
    path: "/backend",
    lazy: async () => ({
      Component: (await import("@/layouts/backendLayout")).default,
    }),
    HydrateFallback: ProgressBar,
    children: [
      {
        index: true,
        element: <Navigate replace to="./landing" />,
      },
      {
        path: "landing",
        lazy: async () => ({
          Component: (await import("@/pages/Landing")).default,
        }),
        HydrateFallback: ProgressBar,
        handle: {
          title: "首页",
        },
      },
      {
        path: "echarts-demo",
        lazy: async () => ({
          Component: (await import("@/pages/EchartsDemo/Layout")).default,
        }),
        HydrateFallback: ProgressBar,
        handle: {
          title: "Echarts Demo",
        },
      },
    ],
  },
  {
    path: "*",
    lazy: async () => ({
      Component: (await import("@/pages/NotFound")).default,
    }),
    HydrateFallback: ProgressBar,
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
