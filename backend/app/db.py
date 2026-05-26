from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _migrate_legacy_projects() -> None:
    """将旧版单项目数据迁移到项目组结构。"""
    inspector = inspect(engine)
    if "bidding_projects" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("bidding_projects")}
    if "group_id" in columns:
        return

    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE bidding_projects ADD COLUMN group_id INTEGER"))

        has_old_attachments = "project_attachments" in inspector.get_table_names()
        if has_old_attachments:
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS bidding_project_groups (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(200) NOT NULL,
                        bid_opening_at DATETIME NOT NULL,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                    """
                )
            )
            conn.execute(
                text(
                    """
                    CREATE TABLE IF NOT EXISTS group_attachments (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        group_id INTEGER NOT NULL,
                        attachment_type VARCHAR(32) NOT NULL,
                        original_name VARCHAR(255) NOT NULL,
                        stored_name VARCHAR(255) NOT NULL,
                        content_type VARCHAR(128),
                        size_bytes INTEGER DEFAULT 0,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(group_id) REFERENCES bidding_project_groups(id) ON DELETE CASCADE
                    )
                    """
                )
            )

            projects = conn.execute(
                text("SELECT id, name, bid_opening_at FROM bidding_projects WHERE group_id IS NULL")
            ).fetchall()

            for project_id, name, bid_opening_at in projects:
                result = conn.execute(
                    text(
                        "INSERT INTO bidding_project_groups (name, bid_opening_at) "
                        "VALUES (:name, :bid_opening_at)"
                    ),
                    {"name": name, "bid_opening_at": bid_opening_at},
                )
                group_id = result.lastrowid
                conn.execute(
                    text("UPDATE bidding_projects SET group_id = :group_id WHERE id = :project_id"),
                    {"group_id": group_id, "project_id": project_id},
                )
                conn.execute(
                    text(
                        """
                        INSERT INTO group_attachments
                            (group_id, attachment_type, original_name, stored_name, content_type, size_bytes, created_at)
                        SELECT :group_id, attachment_type, original_name, stored_name, content_type, size_bytes, created_at
                        FROM project_attachments
                        WHERE project_id = :project_id
                        """
                    ),
                    {"group_id": group_id, "project_id": project_id},
                )
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO bidding_project_groups (name, bid_opening_at)
                    SELECT name, bid_opening_at FROM bidding_projects WHERE group_id IS NULL
                    """
                )
            )
            conn.execute(
                text(
                    """
                    UPDATE bidding_projects
                    SET group_id = (
                        SELECT g.id FROM bidding_project_groups g
                        WHERE g.name = bidding_projects.name
                          AND g.bid_opening_at = bidding_projects.bid_opening_at
                        LIMIT 1
                    )
                    WHERE group_id IS NULL
                    """
                )
            )


def _migrate_owner_column() -> None:
    """为项目组增加所属用户，历史数据默认归属 cqzsxh，并清空 zcs 的数据。"""
    inspector = inspect(engine)
    if "bidding_project_groups" not in inspector.get_table_names():
        return

    columns = {col["name"] for col in inspector.get_columns("bidding_project_groups")}
    if "owner" not in columns:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE bidding_project_groups ADD COLUMN owner VARCHAR(64) DEFAULT 'cqzsxh'")
            )
            conn.execute(text("UPDATE bidding_project_groups SET owner = 'cqzsxh' WHERE owner IS NULL"))

    settings = get_settings()
    with engine.begin() as conn:
        zcs_groups = conn.execute(
            text("SELECT id FROM bidding_project_groups WHERE owner = 'zcs'")
        ).fetchall()
        if zcs_groups:
            attachments = conn.execute(
                text(
                    "SELECT stored_name FROM group_attachments "
                    "WHERE group_id IN (SELECT id FROM bidding_project_groups WHERE owner = 'zcs')"
                )
            ).fetchall()
            for (stored_name,) in attachments:
                file_path = settings.uploads_dir / stored_name
                if file_path.exists():
                    file_path.unlink()
            conn.execute(text("DELETE FROM bidding_project_groups WHERE owner = 'zcs'"))


def _seed_users() -> None:
    from app.services import users as user_service

    with SessionLocal() as db:
        user_service.seed_default_users(db)


def _migrate_project_attachments_table() -> None:
    """确保 project_attachments 表存在（用于项目独立附件）。"""
    inspector = inspect(engine)
    if "project_attachments" in inspector.get_table_names():
        return
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS project_attachments (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    project_id INTEGER NOT NULL,
                    attachment_type VARCHAR(32) NOT NULL,
                    original_name VARCHAR(255) NOT NULL,
                    stored_name VARCHAR(255) NOT NULL,
                    content_type VARCHAR(128),
                    size_bytes INTEGER DEFAULT 0,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(project_id) REFERENCES bidding_projects(id) ON DELETE CASCADE
                )
                """
            )
        )


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_legacy_projects()
    _migrate_owner_column()
    _migrate_project_attachments_table()
    _seed_users()
