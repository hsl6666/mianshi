import dayjs, { type Dayjs } from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import "dayjs/locale/zh-cn";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale("zh-cn");

/** 业务统一使用中国时区（北京时间） */
export const CHINA_TZ = "Asia/Shanghai";

/**
 * 解析后端返回的 naive 时间字符串（按北京时间理解）
 */
export function parseChinaTime(value: dayjs.ConfigType): Dayjs | null {
  if (value === null || value === undefined || value === "") return null;
  const normalized =
    typeof value === "string" ? value.trim().replace("T", " ").replace(/\.\d+/, "") : value;
  const parsed = dayjs.tz(normalized, CHINA_TZ);
  return parsed.isValid() ? parsed : null;
}

/** 格式化展示时间（默认北京时间） */
export function formatChinaTime(
  value: dayjs.ConfigType,
  format: string = "YYYY-MM-DD HH:mm:ss",
): string {
  const time = parseChinaTime(value);
  return time ? time.format(format) : "-";
}

/** 提交给后端的 naive 时间字符串（北京时间） */
export function formatChinaTimeForApi(value: dayjs.ConfigType): string {
  if (!value) return "";
  const time = dayjs.isDayjs(value) ? value.tz(CHINA_TZ, true) : parseChinaTime(value);
  return time ? time.format("YYYY-MM-DDTHH:mm:ss") : "";
}

/** 当前北京时间 */
export function chinaNow(): Dayjs {
  return dayjs().tz(CHINA_TZ);
}
