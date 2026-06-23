import { Tooltip } from "antd";
import type { ReactNode } from "react";

interface EllipsisTooltipProps {
  title: string;
  children?: ReactNode;
  className?: string;
}

export default function EllipsisTooltip({ title, children, className }: EllipsisTooltipProps) {
  const content = children ?? title;
  if (!title || title === "-") {
    return <span className={className}>{content}</span>;
  }

  return (
    <Tooltip title={title}>
      <span className={`inline-block max-w-full truncate align-bottom ${className ?? ""}`}>{content}</span>
    </Tooltip>
  );
}
