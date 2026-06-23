import type { DrawerProps, ModalProps } from "antd";
import { useIsMobile } from "./useIsMobile";

export function useResponsiveOverlay() {
  const isMobile = useIsMobile();

  const modalProps: ModalProps = isMobile
    ? {
        width: "100%",
        centered: false,
        style: { top: 0, margin: 0, padding: 0, maxWidth: "100vw" },
        styles: {
          header: { padding: "12px 16px" },
          body: { maxHeight: "calc(100dvh - 108px)", overflowY: "auto", padding: "12px 16px" },
          footer: { padding: "8px 16px" },
        },
      }
    : {};

  const drawerProps: Partial<DrawerProps> = isMobile
    ? { width: "100%", styles: { body: { padding: 12 } } }
    : {};

  return { isMobile, modalProps, drawerProps };
}
