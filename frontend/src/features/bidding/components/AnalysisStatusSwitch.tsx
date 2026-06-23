import { Switch, Tooltip } from "antd";

interface AnalysisStatusSwitchProps {
  value: boolean;
  disabled?: boolean;
  onChange?: (value: boolean) => void;
}

export default function AnalysisStatusSwitch({ value, disabled, onChange }: AnalysisStatusSwitchProps) {
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <Tooltip title={disabled ? "仅超级管理员可操作" : value ? "已分析（是）" : "未分析（否）"}>
        <Switch
          checked={value}
          checkedChildren="是"
          unCheckedChildren="否"
          disabled={disabled}
          onChange={onChange}
          style={value ? { backgroundColor: "#52c41a" } : { backgroundColor: "#ff4d4f" }}
        />
      </Tooltip>
    </span>
  );
}
