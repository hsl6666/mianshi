import { createBrowserRouter, Navigate, type RouteObject } from "react-router-dom";
import { ProgressBar } from "@/components/ProgressBar";
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
    ],
  },
  {
    path: "*",
    element: <Navigate replace to={ROUTE_PATHS.biddingProjects} />,
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
