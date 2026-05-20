import { RouterProvider } from "react-router-dom";
import { App as AntdApp } from "antd";
import { AntdConfigProvider } from "./components/AntdConfigProvider";
import { StaticAntd } from "./components/StaticAntd";
import { ThemeProvider } from "./components/ThemeProvider";
import { router } from "./routes";

export default function App() {
  return (
    <ThemeProvider>
      <AntdConfigProvider>
        <AntdApp>
          <StaticAntd />
          <RouterProvider
            router={router}
            future={{
              v7_startTransition: true,
            }}
          />
        </AntdApp>
      </AntdConfigProvider>
    </ThemeProvider>
  );
}
