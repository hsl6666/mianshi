import { Select, type SelectProps } from "antd";
import { usePositions } from "../hooks/usePositions";

type PositionSelectProps = Omit<SelectProps, "options" | "loading"> & {
  admin?: boolean;
  includeCommon?: boolean;
};

export default function PositionSelect({ admin = false, includeCommon = true, placeholder = "请选择岗位", ...props }: PositionSelectProps) {
  const { enabledOptions, loading } = usePositions({ admin });

  const options = includeCommon
    ? enabledOptions
    : enabledOptions.filter((item) => item.value !== "通用");

  return (
    <Select
      showSearch
      allowClear
      optionFilterProp="label"
      placeholder={placeholder}
      loading={loading}
      options={options}
      notFoundContent={loading ? "加载中..." : "暂无岗位，请先在后台创建"}
      {...props}
    />
  );
}
