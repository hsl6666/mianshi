import { Link } from "react-router-dom";
import { Button, Flex, Typography } from "antd";
import { ROUTE_PATHS } from "@/constants/common";

export default function LandingPage() {
  return (
    <>
      <Typography.Title level={4}>招投标咨询工作台</Typography.Title>
      <Typography.Paragraph type="secondary">
        管理您协助编写的招投标项目：登记项目资料与文件，开标后录入评审打分反馈。
      </Typography.Paragraph>
      <Flex gap={12} wrap className="w-full">
        <Link to={ROUTE_PATHS.biddingProjects} className="w-full sm:w-auto">
          <Button type="primary" block className="sm:!inline-flex">
            进入项目管理
          </Button>
        </Link>
        <Button
          block
          className="sm:!inline-flex sm:w-auto"
          onClick={() => window.open(`${window.location.origin}/backend/landing`)}
        >
          空白布局示例
        </Button>
      </Flex>
    </>
  );
}
