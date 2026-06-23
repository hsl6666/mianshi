import { Button, Tooltip } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "@/components/ThemeProvider";

type ThemeSwitchProps = {
  className?: string;
};

export function ThemeSwitch({ className }: ThemeSwitchProps) {
  const { isDarkMode, setTheme } = useTheme();

  const handleToggle = async () => {
    const nextTheme = isDarkMode ? "light" : "dark";
    const handler = () => {
      setTheme(nextTheme);
    };

    if (!document.startViewTransition) {
      handler();
      return;
    }

    await document.startViewTransition(handler).ready;

    const r = Math.hypot(window.innerWidth, window.innerHeight);
    document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${window.innerWidth}px 0px)`,
          `circle(${r}px at ${window.innerWidth}px 0px)`,
        ],
      },
      {
        duration: 500,
        easing: "ease-in",
        direction: isDarkMode ? "normal" : "reverse",
        pseudoElement: isDarkMode ? `::view-transition-new(root)` : `::view-transition-old(root)`,
      },
    );
  };

  return (
    <Tooltip title={isDarkMode ? "切换白天模式" : "切换夜间模式"}>
      <Button
        type="text"
        className={className}
        icon={isDarkMode ? <SunOutlined className="text-base" /> : <MoonOutlined className="text-base" />}
        onClick={handleToggle}
        aria-label={isDarkMode ? "切换白天模式" : "切换夜间模式"}
      />
    </Tooltip>
  );
}
