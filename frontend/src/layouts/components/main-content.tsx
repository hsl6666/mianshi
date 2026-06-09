import { Outlet, useMatches } from "react-router-dom";
import { Layout } from "antd";
import { SlideFade } from "@/components/SlideFade";

export default function Content() {
  const matches = useMatches();
  const currRouter = matches.at(-1);
  return (
    <Layout.Content className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 md:p-4">
      <SlideFade key={currRouter!.pathname}>
        <Outlet />
      </SlideFade>
    </Layout.Content>
  );
}
