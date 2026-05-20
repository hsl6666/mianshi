import { ColorPicker } from "antd";
import { setColorPrimary, useSelector, useSettingsStore } from "@/store";
import { SkinOutlined } from '@ant-design/icons';
export default function CustomSkin() {
  const { colorPrimary } = useSettingsStore(useSelector(["colorPrimary"]));
  return (
    <ColorPicker
      showText
      value={colorPrimary}
      onChange={(color) => {
        setColorPrimary(color.toHex());
      }}
    >
      <SkinOutlined></SkinOutlined>
    </ColorPicker>
  );
}
