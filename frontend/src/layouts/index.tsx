import { useEffect } from "react";
import { Layout, Typography } from "antd";
import { FileTextOutlined } from "@ant-design/icons";
import { AppHelmet } from "@/components/Helmet";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { useAuthStore } from "@/store/authStore";
import AppSidebar from "./components/app-sidebar";
import Content from "./components/main-content";
import UserAvatar from "./components/user-avatar";

export default function MainLayout() {
  const hydrateProfile = useAuthStore((s) => s.hydrateProfile);

  useEffect(() => {
    hydrateProfile();
  }, [hydrateProfile]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = document.scrollingElement?.scrollTop || document.body.scrollTop;
      const className = "shadow-[0_6px_10px_-10px_rgba(0,0,0,0.3)]";
      const header = document.getElementById("app-header-bar");
      if (!header) return;
      if (scrollTop > 0) header.classList.add(className);
      else header.classList.remove(className);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <AppHelmet />
      <Layout className="min-h-screen">
        <Layout.Sider
          width={200}
          breakpoint="lg"
          collapsedWidth={0}
          className="hidden md:block bg-white dark:bg-[#001529]"
        >
          <div className="h-14 md:h-16 flex items-center px-4 gap-2 border-b border-gray-100 dark:border-gray-800">
            <FileTextOutlined className="text-blue-500" />
            <Typography.Text strong className="text-sm">
              招投标系统
            </Typography.Text>
          </div>
          <AppSidebar />
        </Layout.Sider>
        <Layout>
          <Layout.Header
            id="app-header-bar"
            className="flex items-center sticky top-0 z-[999] px-3 md:px-4 bg-white dark:bg-[#001529] h-14 md:h-16"
          >
            <Typography.Text strong className="text-base md:text-lg md:hidden">
              招投标项目管理
            </Typography.Text>
            <div className="ml-auto flex items-center gap-2 shrink-0">
              <ThemeSwitch />
              <UserAvatar />
            </div>
          </Layout.Header>
          <div className="md:hidden border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-[#001529] overflow-x-auto">
            <AppSidebar />
          </div>
          <Content />
        </Layout>
      </Layout>
    </>
  );
}
