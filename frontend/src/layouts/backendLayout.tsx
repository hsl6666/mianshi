import { Layout } from "antd";
import { AppHelmet } from "@/components/Helmet";
import Content from "./components/main-content";

export default function BackendLayout() {
  return (
    <>
      <AppHelmet />
      <Layout className="h-screen">
        <Content />
      </Layout>
    </>
  );
}
