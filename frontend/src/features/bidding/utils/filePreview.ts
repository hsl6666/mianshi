import { message } from "antd";
import { apiClient } from "@/request/client";

const PREVIEWABLE_PATTERN = /\.(pdf|png|jpe?g|gif|webp|bmp|svg|txt)$/i;

export function isPreviewableFile(filename: string) {
  return PREVIEWABLE_PATTERN.test(filename);
}

export function getBidVersionPreviewUrl(attachmentId: number) {
  return `/api/bid-versions/${attachmentId}/preview`;
}

export async function previewBidVersion(args: { attachmentId: number; filename: string }) {
  const { attachmentId, filename } = args;
  const url = getBidVersionPreviewUrl(attachmentId);

  try {
    const response = await apiClient.get<Blob>(url, { responseType: "blob" });
    const blob = response.data;
    const contentType = blob?.type || "application/octet-stream";
    const finalBlob = blob instanceof Blob ? new Blob([blob], { type: contentType }) : blob;

    if (!isPreviewableFile(filename)) {
      message.info("该文件类型暂不支持在线预览，请使用下载");
      return false;
    }

    const objectUrl = URL.createObjectURL(finalBlob);
    const previewWindow = window.open(objectUrl, "_blank", "noopener,noreferrer");
    if (!previewWindow) {
      message.warning("浏览器拦截了预览窗口，请允许弹窗后重试");
      URL.revokeObjectURL(objectUrl);
      return false;
    }
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : "预览失败");
    return false;
  }
}

export async function downloadBidVersionFile(args: { attachmentId: number; filename: string }) {
  const { attachmentId, filename } = args;
  const url = `/api/bid-versions/${attachmentId}/download`;

  const response = await apiClient.get<Blob>(url, { responseType: "blob" });
  const blob = response.data;
  const contentType = blob?.type || "application/octet-stream";
  const finalBlob = blob instanceof Blob ? new Blob([blob], { type: contentType }) : blob;

  const objectUrl = URL.createObjectURL(finalBlob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}
