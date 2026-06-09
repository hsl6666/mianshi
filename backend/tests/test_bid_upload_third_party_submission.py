from __future__ import annotations

import asyncio
from datetime import datetime
import importlib
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, Mock, patch

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class BidUploadThirdPartySubmissionTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = {
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
            "UPLOADS_DIR": os.environ.get("UPLOADS_DIR"),
            "THIRD_PARTY_API_BASE_URL": os.environ.get("THIRD_PARTY_API_BASE_URL"),
            "REPORT_DATA_UPLOAD_API_KEY": os.environ.get("REPORT_DATA_UPLOAD_API_KEY"),
        }
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        tmp_path = Path(self._tmp.name)
        uploads_dir = tmp_path / "uploads"
        uploads_dir.mkdir()
        os.environ["DATABASE_URL"] = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
        os.environ["UPLOADS_DIR"] = str(uploads_dir)
        os.environ["THIRD_PARTY_API_BASE_URL"] = "http://third-party.test"
        os.environ["REPORT_DATA_UPLOAD_API_KEY"] = "report-test-key"
        _purge_app_modules()

        self.db_module = importlib.import_module("app.db")
        self.db_module.init_db()
        self.models = importlib.import_module("app.models")
        self.schemas = importlib.import_module("app.schemas")
        self.group_id = self._seed_group()
        app = importlib.import_module("app.main").app
        self.client = TestClient(app)

    def tearDown(self) -> None:
        self.client.close()
        self.db_module.engine.dispose()
        for key, value in self._old_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value
        self._tmp.cleanup()
        _purge_app_modules()

    def test_bind_submission_id_after_upload_and_report_push_matches_it(self) -> None:
        upload_response = self.client.post(
            "/api/bidding-projects",
            headers=self._auth_headers(),
            data={
                "db_id": str(self.group_id),
                "name": "Upload Trigger Project",
                "participating_units": "Upload Trigger Company",
            },
            files={
                "bid_file": (
                    "response.docx",
                    b"bid response bytes",
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                ),
            },
        )

        self.assertEqual(upload_response.status_code, 201, upload_response.text)
        version = upload_response.json()["companies"][0]["attachments"][0]
        self.assertIsNone(version["third_party_submission_file_id"])

        bind_response = self.client.patch(
            f"/api/bid-versions/{version['id']}/third-party-submission",
            headers=self._auth_headers(),
            json={
                "submission_file_id": "submission-file-business-id-001",
                "status": "accepted",
            },
        )

        self.assertEqual(bind_response.status_code, 200, bind_response.text)
        bound_version = bind_response.json()
        self.assertEqual(bound_version["third_party_submission_file_id"], "submission-file-business-id-001")
        self.assertEqual(bound_version["report_status"], "analyzing")

        push_response = self.client.post(
            "/api/bid-versions/report-data",
            json={
                "submission_file_id": "submission-file-business-id-001",
                "report": {
                    "report_title": "Third-party pushed report",
                    "score_summary": {"final_score": 91},
                },
            },
        )

        self.assertEqual(push_response.status_code, 200, push_response.text)
        pushed_version = push_response.json()
        self.assertEqual(pushed_version["id"], bound_version["id"])
        self.assertEqual(pushed_version["third_party_submission_file_id"], "submission-file-business-id-001")
        self.assertTrue(pushed_version["report_has_data"])

    def _auth_headers(self) -> dict[str, str]:
        security = importlib.import_module("app.core.security")
        token = security.create_access_token("cqzsxh", self.models.UserRole.super_admin)
        return {"Authorization": f"Bearer {token}"}

    def _seed_group(self) -> int:
        models = self.models
        uploads_dir = Path(os.environ["UPLOADS_DIR"])
        (uploads_dir / "tender.pdf").write_bytes(b"tender bytes")
        with self.db_module.SessionLocal() as db:
            group = models.BiddingProjectGroup(
                owner="cqzsxh",
                name="Third-party Linked Group",
                bid_opening_at=datetime(2026, 6, 20, 9, 30),
                third_party_db_id="third-party-project-db-id",
                project_code="TP-2026-001",
            )
            db.add(group)
            db.flush()
            tender = models.GroupAttachment(
                group_id=group.id,
                attachment_type=models.AttachmentType.tender_doc,
                original_name="tender.pdf",
                stored_name="tender.pdf",
                content_type="application/pdf",
                size_bytes=12,
            )
            db.add(tender)
            db.commit()
            return group.id


class ThirdPartySubmissionClientTests(unittest.TestCase):
    def test_submission_upload_enables_analysis(self) -> None:
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.__aexit__.return_value = None
        response = Mock()
        response.json.return_value = {
            "status": "accepted",
            "submission_file": {"id": "submission-file-id"},
        }
        client.post.return_value = response

        third_party_client = importlib.import_module("app.services.third_party_bidding_client")
        with patch.object(third_party_client.httpx, "AsyncClient", return_value=client):
            result = asyncio.run(
                third_party_client.analyze_submission_file(
                    base_url="http://third-party.test",
                    access_token="token",
                    project_id="project-id",
                    company_name="Bidder",
                    response_file_name="response.docx",
                    response_file_bytes=b"response",
                )
            )

        self.assertEqual(result.submission_file.id, "submission-file-id")
        self.assertEqual(client.post.await_args.kwargs["data"]["enable_analysis"], "true")
        self.assertEqual(client.post.await_args.kwargs["headers"]["Authorization"], "Bearer token")


def _purge_app_modules() -> None:
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            sys.modules.pop(name, None)


if __name__ == "__main__":
    unittest.main()
