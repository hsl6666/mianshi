import { useState } from "react";
import { Button, Input, Select } from "antd";
import { PlusOutlined, UnorderedListOutlined } from "@ant-design/icons";

type FieldMode = "select" | "input";

interface SelectOrInputProps {
  value?: string;
  onChange?: (value: string) => void;
  options: string[];
  loading?: boolean;
  disabled?: boolean;
  selectPlaceholder?: string;
  inputPlaceholder?: string;
  maxLength?: number;
}

export default function SelectOrInput({
  value,
  onChange,
  options,
  loading,
  disabled,
  selectPlaceholder = "请选择",
  inputPlaceholder = "请输入",
  maxLength = 200,
}: SelectOrInputProps) {
  const [mode, setMode] = useState<FieldMode>("select");

  const switchToInput = () => {
    setMode("input");
    onChange?.("");
  };

  const switchToSelect = () => {
    setMode("select");
    onChange?.("");
  };

  if (mode === "input") {
    return (
      <div className="flex w-full gap-2">
        <Input
          className="flex-1"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={inputPlaceholder}
          maxLength={maxLength}
          showCount
          disabled={disabled}
        />
        <Button
          type="default"
          icon={<UnorderedListOutlined />}
          onClick={switchToSelect}
          disabled={disabled}
          title="从已有选项选择"
        />
      </div>
    );
  }

  return (
    <div className="flex w-full gap-2">
      <Select
        className="flex-1"
        value={value || undefined}
        onChange={(next) => onChange?.(next)}
        placeholder={selectPlaceholder}
        loading={loading}
        disabled={disabled}
        showSearch
        allowClear
        optionFilterProp="label"
        options={options.map((item) => ({ value: item, label: item }))}
        notFoundContent={
          loading ? undefined : "本组暂无历史记录，请点击右侧 + 新建"
        }
      />
      <Button
        type="default"
        icon={<PlusOutlined />}
        onClick={switchToInput}
        disabled={disabled}
        title="新建"
      />
    </div>
  );
}
