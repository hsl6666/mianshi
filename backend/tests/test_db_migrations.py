import importlib
import os
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


class OwnerMigrationTests(unittest.TestCase):
    def test_owner_migration_preserves_existing_owner_groups(self) -> None:
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
            tmp_path = Path(tmp)
            db_path = tmp_path / "app.db"
            uploads_dir = tmp_path / "uploads"
            uploads_dir.mkdir()

            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    """
                    CREATE TABLE bidding_project_groups (
                        id INTEGER PRIMARY KEY,
                        owner VARCHAR(64),
                        name VARCHAR(200) NOT NULL,
                        bid_opening_at DATETIME NOT NULL,
                        created_at DATETIME,
                        updated_at DATETIME
                    )
                    """
                )
                conn.execute(
                    """
                    CREATE TABLE group_attachments (
                        id INTEGER PRIMARY KEY,
                        group_id INTEGER NOT NULL,
                        stored_name VARCHAR(255) NOT NULL
                    )
                    """
                )
                conn.executemany(
                    """
                    INSERT INTO bidding_project_groups
                        (id, owner, name, bid_opening_at, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    [
                        (1, "zcs", "zcs group", "2026-06-01 10:00:00", None, None),
                        (2, "hsl", "hsl group", "2026-06-02 10:00:00", None, None),
                    ],
                )

            old_database_url = os.environ.get("DATABASE_URL")
            old_uploads_dir = os.environ.get("UPLOADS_DIR")
            os.environ["DATABASE_URL"] = f"sqlite:///{db_path.as_posix()}"
            os.environ["UPLOADS_DIR"] = str(uploads_dir)
            sys.modules.pop("app.db", None)
            sys.modules.pop("app.core.config", None)

            try:
                db_module = importlib.import_module("app.db")
                db_module._migrate_owner_column()
            finally:
                if "db_module" in locals():
                    db_module.engine.dispose()
                if old_database_url is None:
                    os.environ.pop("DATABASE_URL", None)
                else:
                    os.environ["DATABASE_URL"] = old_database_url
                if old_uploads_dir is None:
                    os.environ.pop("UPLOADS_DIR", None)
                else:
                    os.environ["UPLOADS_DIR"] = old_uploads_dir
                sys.modules.pop("app.db", None)
                sys.modules.pop("app.core.config", None)

            with sqlite3.connect(db_path) as conn:
                rows = conn.execute(
                    "SELECT owner, name FROM bidding_project_groups ORDER BY id"
                ).fetchall()

            self.assertEqual(rows, [("zcs", "zcs group"), ("hsl", "hsl group")])


if __name__ == "__main__":
    unittest.main()
