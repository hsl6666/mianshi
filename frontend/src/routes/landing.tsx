import { type RouteObject } from "react-router-dom";
import { ProgressBar } from "@/components/ProgressBar";
import { ROUTE_PATHS } from "@/constants/common";

export const landingRoute: RouteObject = {
  path: ROUTE_PATHS.landing,
  lazy: async () => ({
    Component: (await import("@/pages/Landing")).default,
  }),
  HydrateFallback: ProgressBar,
  handle: {
    title: "首页",
  },
};
