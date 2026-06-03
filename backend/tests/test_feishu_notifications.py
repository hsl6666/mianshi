from __future__ import annotations

from datetime import datetime
import importlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

import httpx

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class FeishuNotificationTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._old_env = {
            "FEISHU_BID_NOTIFY_WEBHOOK_URL": os.environ.get("FEISHU_BID_NOTIFY_WEBHOOK_URL"),
            "FEISHU_BID_NOTIFY_SECRET": os.environ.get("FEISHU_BID_NOTIFY_SECRET"),
            "FEISHU_BID_NOTIFY_AT_USER_ID": os.environ.get("FEISHU_BID_NOTIFY_AT_USER_ID"),
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
            "UPLOADS_DIR": os.environ.get("UPLOADS_DIR"),
        }
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        tmp_path = Path(self._tmp.name)
        os.environ["DATABASE_URL"] = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
        os.environ["UPLOADS_DIR"] = str(tmp_path / "uploads")
        os.environ["FEISHU_BID_NOTIFY_WEBHOOK_URL"] = "https://open.feishu.cn/open-apis/bot/v2/hook/test"
        os.environ["FEISHU_BID_NOTIFY_SECRET"] = "test-secret"
        os.environ["FEISHU_BID_NOTIFY_AT_USER_ID"] = "ou_test_user"
        sys.modules.pop("app.core.config", None)
        sys.modules.pop("app.services.feishu_notifications", None)

    def tearDown(self) -> None:
        for key, value in self._old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self._tmp.cleanup()
        sys.modules.pop("app.core.config", None)
        sys.modules.pop("app.services.feishu_notifications", None)

    def test_feishu_sign_matches_documented_algorithm(self) -> None:
        notifications = importlib.import_module("app.services.feishu_notifications")

        sign = notifications.generate_feishu_sign("1700000000", "test-secret")

        self.assertEqual(sign, "mbm4Y4oluIPQ00qlBIhX8vAZ0EKv3nw0LuTb91jPL84=")

    async def test_bid_upload_notification_posts_signed_at_message(self) -> None:
        notifications = importlib.import_module("app.services.feishu_notifications")
        requests: list[dict] = []

        def handler(request: httpx.Request) -> httpx.Response:
            requests.append(json.loads(request.content.decode("utf-8")))
            return httpx.Response(200, json={"code": 0, "msg": "success"})

        sent = await notifications.notify_bid_upload(
            notifications.BidUploadNotification(
                group_name="Group A",
                project_name="Project Alpha",
                company_name="Bidder One",
                original_name="bid.zip",
                version_number=2,
                size_bytes=2048,
                uploaded_by="alice",
                uploaded_at=datetime(2026, 6, 1, 19, 30, 0),
            ),
            now=lambda: 1700000000,
            transport=httpx.MockTransport(handler),
        )

        self.assertTrue(sent)
        self.assertEqual(len(requests), 1)
        payload = requests[0]
        self.assertEqual(payload["timestamp"], "1700000000")
        self.assertEqual(payload["sign"], "mbm4Y4oluIPQ00qlBIhX8vAZ0EKv3nw0LuTb91jPL84=")
        self.assertEqual(payload["msg_type"], "text")
        text = payload["content"]["text"]
        self.assertIn('<at user_id="ou_test_user">', text)
        self.assertIn("Group A", text)
        self.assertIn("Project Alpha", text)
        self.assertIn("Bidder One", text)
        self.assertIn("bid.zip", text)
        self.assertIn("v2", text)


if __name__ == "__main__":
    unittest.main()
