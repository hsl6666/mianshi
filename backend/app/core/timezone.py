from datetime import datetime
from zoneinfo import ZoneInfo


CHINA_TZ = ZoneInfo("Asia/Shanghai")


def china_now() -> datetime:
    """返回当前北京时间（naive datetime，不含时区信息）。"""
    return datetime.now(CHINA_TZ).replace(tzinfo=None)
