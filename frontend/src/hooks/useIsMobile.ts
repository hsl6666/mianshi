import { Grid } from "antd";

/** 宽度 < 768px 视为移动端 H5 */
export function useIsMobile(breakpoint: "sm" | "md" = "md") {
  const screens = Grid.useBreakpoint();
  return !screens[breakpoint];
}
