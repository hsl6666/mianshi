import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Button, Result } from "antd";
import { ROUTE_PATHS } from "@/constants/common";

export default function NotFound() {
  const navigate = useNavigate();
  const titleSuffix = import.meta.env.VITE_APP_TITLE_SUFFIX || "AI Interviewer";

  return (
    <>
      <Helmet>
        <title>{`404 | ${titleSuffix}`}</title>
      </Helmet>
      <Result
        status="404"
        title="404"
        subTitle="您访问的页面不存在。"
        extra={
          <Button type="primary" onClick={() => navigate(ROUTE_PATHS.landing)}>
            返回首页
          </Button>
        }
      />
    </>
  );
}
