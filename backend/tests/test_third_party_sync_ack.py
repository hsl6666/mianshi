from __future__ import annotations

from datetime import datetime
import importlib
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class ThirdPartySyncAckTests(unittest.TestCase):
    def setUp(self) -> None:
        self._old_env = {
            "DATABASE_URL": os.environ.get("DATABASE_URL"),
            "UPLOADS_DIR": os.environ.get("UPLOADS_DIR"),
        }
        self._tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        tmp_path = Path(self._tmp.name)
        uploads_dir = tmp_path / "uploads"
        uploads_dir.mkdir()
        os.environ["DATABASE_URL"] = f"sqlite:///{(tmp_path / 'app.db').as_posix()}"
        os.environ["UPLOADS_DIR"] = str(uploads_dir)
        _purge_app_modules()

        self.db_module = importlib.import_module("app.db")
        self.db_module.init_db()
        self.models = importlib.import_module("app.models")
        self._seed_missing_file_project()
        self.project_id, self.bid_attachment_id = self._seed_sync_test_data()
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

    def test_basic_info_fetch_does_not_mark_bid_file_synced(self) -> None:
        response = self.client.get("/api/third-party/bidding-files/basic-info")

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["project_id"], self.project_id)
        self.assertEqual(body["project_name"], "SYNC-TEST Seed Project")
        self.assertEqual(body["third_party_sync_status"], "unsynced")
        self.assertEqual(body["bid_files"][0]["id"], self.bid_attachment_id)
        self.assertEqual(body["bid_files"][0]["third_party_sync_status"], "unsynced")

        with self.db_module.SessionLocal() as db:
            attachment = db.get(self.models.ProjectAttachment, self.bid_attachment_id)
            self.assertEqual(attachment.third_party_sync_status.value, "unsynced")
            self.assertIsNone(attachment.third_party_sync_metadata)

    def test_ack_marks_bid_file_synced_and_stores_local_associations(self) -> None:
        response = self.client.post(
            f"/api/third-party/bidding-files/bids/{self.bid_attachment_id}/ack",
            json={
                "status": "synced",
                "source_system": "mianshi",
                "external_record_id": f"mianshi:bid-file:{self.bid_attachment_id}",
                "local_project_id": "local-project-id",
                "local_company_id": "local-company-id",
                "local_bid_file_id": "local-bid-file-id",
                "local_task_id": "local-task-id",
                "test_marker": "SYNC-TEST-ACK",
            },
        )

        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["id"], self.bid_attachment_id)
        self.assertEqual(body["third_party_sync_status"], "synced")

        with self.db_module.SessionLocal() as db:
            attachment = db.get(self.models.ProjectAttachment, self.bid_attachment_id)
            project = db.get(self.models.BiddingProject, self.project_id)
            self.assertEqual(attachment.third_party_sync_status.value, "synced")
            self.assertEqual(project.third_party_sync_status.value, "synced")
            metadata = json.loads(attachment.third_party_sync_metadata)

        self.assertEqual(
            metadata,
            {
                "status": "synced",
                "source_system": "mianshi",
                "external_record_id": f"mianshi:bid-file:{self.bid_attachment_id}",
                "local_project_id": "local-project-id",
                "local_company_id": "local-company-id",
                "local_bid_file_id": "local-bid-file-id",
                "local_task_id": "local-task-id",
                "test_marker": "SYNC-TEST-ACK",
            },
        )

    def test_websocket_sends_unsynced_bid_file_and_accepts_ack(self) -> None:
        with self.client.websocket_connect("/api/third-party/bidding-files/socket") as websocket:
            websocket.send_json({"type": "ping", "payload": None})
            initial = websocket.receive_json()
            self.assertEqual(initial["type"], "pong")

            response = self.client.post(
                "/api/bidding-projects",
                headers=self._auth_headers(),
                data={
                    "name": "SYNC-TEST Uploaded Project",
                    "participating_units": "SYNC-TEST Uploaded Company",
                    "project_name": "SYNC-TEST Uploaded Group",
                    "bid_opening_time": "2026-06-03T09:30:00",
                },
                files={
                    "tender_doc": (
                        "SYNC-TEST uploaded tender.pdf",
                        b"SYNC-TEST uploaded tender",
                        "application/pdf",
                    ),
                    "bid_file": (
                        "SYNC-TEST uploaded response.docx",
                        b"SYNC-TEST uploaded response",
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    ),
                },
            )
            self.assertEqual(response.status_code, 201)

            message = websocket.receive_json()
            self.assertEqual(message["type"], "sync_batch")
            payload = message["payload"]
            self.assertEqual(payload["project_name"], "SYNC-TEST Uploaded Project")
            self.assertEqual(len(payload["bid_files"]), 1)
            uploaded_bid_id = payload["bid_files"][0]["id"]
            self.assertEqual(payload["bid_files"][0]["original_name"], "SYNC-TEST uploaded response.docx")
            self.assertEqual(payload["bid_files"][0]["third_party_sync_status"], "unsynced")

            websocket.send_json(
                {
                    "type": "ack",
                    "payload": {
                        "status": "synced",
                        "source_system": "mianshi",
                        "external_record_id": f"mianshi:bid-file:{uploaded_bid_id}",
                        "local_project_id": "socket-local-project-id",
                        "local_company_id": "socket-local-company-id",
                        "local_bid_file_id": "socket-local-bid-file-id",
                        "local_task_id": "socket-local-task-id",
                        "test_marker": "SYNC-TEST-SOCKET",
                    },
                }
            )
            ack = websocket.receive_json()

        self.assertEqual(ack["type"], "ack_ok")
        self.assertEqual(ack["payload"]["id"], uploaded_bid_id)
        self.assertEqual(ack["payload"]["third_party_sync_status"], "synced")
        with self.db_module.SessionLocal() as db:
            attachment = db.get(self.models.ProjectAttachment, uploaded_bid_id)
            metadata = json.loads(attachment.third_party_sync_metadata)
        self.assertEqual(metadata["local_project_id"], "socket-local-project-id")
        self.assertEqual(metadata["local_bid_file_id"], "socket-local-bid-file-id")
        self.assertEqual(metadata["test_marker"], "SYNC-TEST-SOCKET")

    def _auth_headers(self) -> dict[str, str]:
        security = importlib.import_module("app.core.security")
        token = security.create_access_token(
            "cqzsxh",
            self.models.UserRole.super_admin,
        )
        return {"Authorization": f"Bearer {token}"}

    def _seed_sync_test_data(self) -> tuple[int, int]:
        models = self.models
        uploads_dir = Path(os.environ["UPLOADS_DIR"])
        uploads_dir.mkdir(parents=True, exist_ok=True)
        (uploads_dir / "sync-test-tender.pdf").write_bytes(b"SYNC-TEST tender")
        (uploads_dir / "sync-test-response.docx").write_bytes(b"SYNC-TEST response")
        with self.db_module.SessionLocal() as db:
            group = models.BiddingProjectGroup(
                owner="SYNC-TEST",
                name="SYNC-TEST Seed Group",
                bid_opening_at=datetime(2026, 6, 3, 9, 30, 0),
            )
            db.add(group)
            db.flush()
            project = models.BiddingProject(
                group_id=group.id,
                name="SYNC-TEST Seed Project",
                participating_units="SYNC-TEST Seed Company",
                bid_opening_at=datetime(2026, 6, 3, 9, 30, 0),
            )
            db.add(project)
            db.flush()
            tender = models.GroupAttachment(
                group_id=group.id,
                attachment_type=models.AttachmentType.tender_doc,
                original_name="SYNC-TEST seed tender.pdf",
                stored_name="sync-test-tender.pdf",
                content_type="application/pdf",
                size_bytes=64,
            )
            company = models.BiddingCompany(
                project_id=project.id,
                name="SYNC-TEST Seed Company",
            )
            db.add_all([tender, company])
            db.flush()
            bid = models.ProjectAttachment(
                project_id=project.id,
                company_id=company.id,
                attachment_type=models.AttachmentType.bid_doc,
                original_name="SYNC-TEST seed response v2.docx",
                stored_name="sync-test-response.docx",
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                size_bytes=128,
                version_number=2,
            )
            db.add(bid)
            db.commit()
            return project.id, bid.id

    def _seed_missing_file_project(self) -> None:
        models = self.models
        with self.db_module.SessionLocal() as db:
            group = models.BiddingProjectGroup(
                owner="SYNC-TEST",
                name="SYNC-TEST Missing File History Group",
                bid_opening_at=datetime(2026, 5, 1, 9, 30, 0),
            )
            db.add(group)
            db.flush()
            project = models.BiddingProject(
                group_id=group.id,
                name="SYNC-TEST Missing File History Project",
                participating_units="SYNC-TEST Missing File Company",
                bid_opening_at=datetime(2026, 5, 1, 9, 30, 0),
            )
            db.add(project)
            db.flush()
            company = models.BiddingCompany(
                project_id=project.id,
                name="SYNC-TEST Missing File Company",
            )
            tender = models.GroupAttachment(
                group_id=group.id,
                attachment_type=models.AttachmentType.tender_doc,
                original_name="SYNC-TEST missing tender.pdf",
                stored_name="missing-sync-test-tender.pdf",
                content_type="application/pdf",
                size_bytes=64,
            )
            db.add_all([company, tender])
            db.flush()
            bid = models.ProjectAttachment(
                project_id=project.id,
                company_id=company.id,
                attachment_type=models.AttachmentType.bid_doc,
                original_name="SYNC-TEST missing response.docx",
                stored_name="missing-sync-test-response.docx",
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                size_bytes=128,
                version_number=1,
            )
            db.add(bid)
            db.commit()


def _purge_app_modules() -> None:
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            sys.modules.pop(name, None)


if __name__ == "__main__":
    unittest.main()
