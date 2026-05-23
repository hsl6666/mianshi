import { type RouteObject } from "react-router-dom";
import { ProgressBar } from "@/components/ProgressBar";
import { ROUTE_PATHS } from "@/constants/common";

export const tuijianRoute: RouteObject = {
  path: ROUTE_PATHS.tuijian,
  lazy: async () => ({
    Component: (await import("@/pages/Tuijian")).default,
  }),
  HydrateFallback: ProgressBar,
  handle: {
    title: "推荐",
  },
};
