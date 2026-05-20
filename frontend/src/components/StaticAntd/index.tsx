import { App } from "antd";

export function StaticAntd() {
  const staticFunction = App.useApp();
  window.$message = staticFunction.message;
  window.$modal = staticFunction.modal;
  window.$notification = staticFunction.notification;
  return null;
}

// export { message, modal, notification };
