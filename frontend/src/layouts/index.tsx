import { useEffect } from "react";
import { Flex, Layout, Typography } from "antd";
import { AppHelmet } from "@/components/Helmet";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import Content from "./components/main-content";
import UserAvatar from "./components/user-avatar";

export default function MainLayout() {
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
        <Layout>
          <Layout.Header
            id="app-header-bar"
            className="flex items-center sticky top-0 z-[999] px-3 md:px-4 bg-white dark:bg-[#001529] h-14 md:h-16"
          >
            <Typography.Text strong className="text-base md:text-lg">
              招投标项目管理
            </Typography.Text>
            <Flex gap={8} className="ml-auto items-center shrink-0">
              <ThemeSwitch />
              <UserAvatar />
            </Flex>
          </Layout.Header>
          <Content />
        </Layout>
      </Layout>
    </>
  );
}
