import { Result } from "antd";
import { InterviewShell } from "../components/InterviewShell";

export default function CompletePage() {
  return (
    <InterviewShell current="done" title="面试流程已完成" description="系统已保存基础信息、笔试提交、口试 QA 与摄像头随机抽帧。">
      <section className="rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <Result
          status="success"
          title="提交成功"
          subTitle="感谢参加本轮 AI 面试，我们将在三个工作日内通知后续安排。"
          extra={[
            // <Button key="results" onClick={() => navigate("/interview/results")}>
            //   查看面试结果
            // </Button>,
            // <Button type="primary" key="restart" onClick={restart}>
            //   开始新的候选人流程
            // </Button>,
          ]}
        />
      </section>
    </InterviewShell>
  );
}
