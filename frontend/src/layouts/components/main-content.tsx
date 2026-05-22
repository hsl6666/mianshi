import { Outlet, useMatches } from "react-router-dom";
import { Layout } from "antd";
import { SlideFade } from "@/components/SlideFade";

export default function Content() {
  const matches = useMatches();
  const currRouter = matches.at(-1);
  return (
    <Layout.Content className="min-h-[calc(100vh-56px)] md:min-h-[calc(100vh-64px)] p-3 md:p-4 overflow-x-hidden">
      <SlideFade key={currRouter!.pathname}>
        <Outlet />
      </SlideFade>
    </Layout.Content>
  );
}
