import type { PropsWithChildren } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import { useTheme } from "@/components/ThemeProvider";
import { useSelector, useSettingsStore } from "@/store";

import "dayjs/locale/zh-cn";

export function AntdConfigProvider({ children }: PropsWithChildren) {
  const { isDarkMode } = useTheme();
  const { defaultAlgorithm, darkAlgorithm } = antdTheme;
  const { colorPrimary } = useSettingsStore(useSelector(["colorPrimary"]));
  return (
    <ConfigProvider
      theme={{
        cssVar: { key: "quanzhan" },
        hashed: false,
        algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
        token: {
          colorPrimary,
        },
        components: {
          Layout: {
            headerPadding: "0 24px",
          },
        },
      }}
      componentSize="large"
    >
      {children}
    </ConfigProvider>
  );
}
