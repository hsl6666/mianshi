import type { MouseEvent } from "react";
import EllipsisTooltip from "./EllipsisTooltip";
import { previewBidVersion } from "../utils/filePreview";

interface BidFilePreviewLinkProps {
  attachmentId: number;
  filename: string;
  prefix?: string;
  className?: string;
}

export default function BidFilePreviewLink({
  attachmentId,
  filename,
  prefix = "",
  className,
}: BidFilePreviewLinkProps) {
  const fullTitle = `${prefix}${filename}`;

  const handleClick = async (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    event.stopPropagation();
    await previewBidVersion({ attachmentId, filename });
  };

  return (
    <EllipsisTooltip title={fullTitle} className={className}>
      <a href="#" className="text-blue-600 hover:underline" onClick={handleClick}>
        {prefix}
        {filename}
      </a>
    </EllipsisTooltip>
  );
}
