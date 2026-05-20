import { Button, DatePicker, Flex, Typography } from "antd";

const { RangePicker } = DatePicker;

export default function LandingPage() {
  return (
    <>
      <Typography.Title level={4}>首页</Typography.Title>
      <Flex gap={16} wrap>
        <RangePicker />
        <Button type="primary" onClick={() => (window as any).$message?.success("show message success!")}>
          message
        </Button>
        <Button type="primary" onClick={() => {window.open(`${window.location.origin}/backend/landing`)}} >open 到空白布局打开</Button>
      </Flex>
      {/* <div className="h-screen" /> */}
    </>
  );
}
