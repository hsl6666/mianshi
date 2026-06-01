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


def _migrate_operation_log_timezone() -> None:
    """将历史操作日志从 SQLite CURRENT_TIMESTAMP 的 UTC 时间修正为北京时间。"""
    inspector = inspect(engine)
    if "operation_logs" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "operation_logs_china_timezone_v1"},
        ).fetchone()
        if marker:
            return

        if settings.database_url.startswith("sqlite"):
            conn.execute(
                text(
                    """
                    UPDATE operation_logs
                    SET created_at = datetime(created_at, '+8 hours')
                    WHERE created_at IS NOT NULL
                    """
                )
            )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "operation_logs_china_timezone_v1"},
        )


def _migrate_attachment_timezone() -> None:
    """将历史附件上传时间从 SQLite CURRENT_TIMESTAMP 的 UTC 时间修正为北京时间。"""
    inspector = inspect(engine)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "attachments_china_timezone_v1"},
        ).fetchone()
        if marker:
            return

        if settings.database_url.startswith("sqlite"):
            table_names = set(inspector.get_table_names())
            for table_name in ("group_attachments", "project_attachments"):
                if table_name in table_names:
                    conn.execute(
                        text(
                            f"""
                            UPDATE {table_name}
                            SET created_at = datetime(created_at, '+8 hours')
                            WHERE created_at IS NOT NULL
                            """
                        )
                    )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "attachments_china_timezone_v1"},
        )


def _migrate_bidding_entity_timezone() -> None:
    """将招投标主表历史时间从 SQLite UTC 修正为北京时间。"""
    inspector = inspect(engine)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "bidding_entities_china_timezone_v1"},
        ).fetchone()
        if marker:
            return

        if settings.database_url.startswith("sqlite"):
            table_names = set(inspector.get_table_names())
            targets = [
                ("bidding_project_groups", ("created_at", "updated_at")),
                ("bidding_projects", ("created_at", "updated_at")),
                ("project_feedbacks", ("created_at", "updated_at")),
                ("users", ("created_at", "updated_at")),
            ]
            for table_name, columns in targets:
                if table_name not in table_names:
                    continue
                for column in columns:
                    conn.execute(
                        text(
                            f"""
                            UPDATE {table_name}
                            SET {column} = datetime({column}, '+8 hours')
                            WHERE {column} IS NOT NULL
                            """
                        )
                    )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "bidding_entities_china_timezone_v1"},
        )


def _migrate_bidding_companies() -> None:
    """创建投标单位表，并将历史投标文件迁移到公司维度。"""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "bidding_companies_v1"},
        ).fetchone()
        if marker:
            return

        if "bidding_companies" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE bidding_companies (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        project_id INTEGER NOT NULL,
                        name VARCHAR(200) NOT NULL,
                        created_at DATETIME,
                        updated_at DATETIME,
                        FOREIGN KEY(project_id) REFERENCES bidding_projects(id) ON DELETE CASCADE
                    )
                    """
                )
            )

        if "project_attachments" in table_names:
            columns = {col["name"] for col in inspector.get_columns("project_attachments")}
            if "company_id" not in columns:
                conn.execute(
                    text("ALTER TABLE project_attachments ADD COLUMN company_id INTEGER")
                )

        if "project_attachments" in table_names and "bidding_companies" in table_names:
            rows = conn.execute(
                text(
                    """
                    SELECT pa.id, pa.project_id, pa.attachment_type, p.participating_units
                    FROM project_attachments pa
                    JOIN bidding_projects p ON p.id = pa.project_id
                    WHERE pa.company_id IS NULL AND pa.attachment_type = 'bid_doc'
                    """
                )
            ).fetchall()
            for row in rows:
                attachment_id, project_id, _attachment_type, participating_units = row
                company_name = (participating_units or "未命名单位").strip()
                if not company_name:
                    company_name = "未命名单位"
                if len(company_name) > 200:
                    company_name = company_name[:200]
                result = conn.execute(
                    text(
                        """
                        INSERT INTO bidding_companies (project_id, name, created_at, updated_at)
                        VALUES (:project_id, :name, datetime('now', 'localtime'), datetime('now', 'localtime'))
                        """
                    ),
                    {"project_id": project_id, "name": company_name},
                )
                company_id = result.lastrowid
                conn.execute(
                    text("UPDATE project_attachments SET company_id = :company_id WHERE id = :id"),
                    {"company_id": company_id, "id": attachment_id},
                )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "bidding_companies_v1"},
        )


def _migrate_bid_version_numbers() -> None:
    """为投标文件补充版本号。"""
    inspector = inspect(engine)
    if "project_attachments" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "bid_version_numbers_v1"},
        ).fetchone()
        if marker:
            return

        columns = {col["name"] for col in inspector.get_columns("project_attachments")}
        if "version_number" not in columns:
            conn.execute(text("ALTER TABLE project_attachments ADD COLUMN version_number INTEGER"))

        rows = conn.execute(
            text(
                """
                SELECT id, company_id, created_at
                FROM project_attachments
                WHERE attachment_type = 'bid_doc' AND company_id IS NOT NULL
                ORDER BY company_id ASC, created_at ASC, id ASC
                """
            )
        ).fetchall()
        version_map: dict[int, int] = {}
        for attachment_id, company_id, _created_at in rows:
            version_map[company_id] = version_map.get(company_id, 0) + 1
            conn.execute(
                text("UPDATE project_attachments SET version_number = :version WHERE id = :id"),
                {"version": version_map[company_id], "id": attachment_id},
            )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "bid_version_numbers_v1"},
        )


def _migrate_company_feedbacks() -> None:
    """将项目级评审反馈迁移到投标单位维度。"""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "company_feedbacks_v1"},
        ).fetchone()
        if marker:
            return

        if "company_feedbacks" not in table_names:
            conn.execute(
                text(
                    """
                    CREATE TABLE company_feedbacks (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        company_id INTEGER NOT NULL UNIQUE,
                        final_score NUMERIC(10, 2) NOT NULL,
                        ranking INTEGER,
                        score_detail TEXT,
                        remark TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(company_id) REFERENCES bidding_companies(id) ON DELETE CASCADE
                    )
                    """
                )
            )

        if "project_feedbacks" in table_names:
            rows = conn.execute(
                text(
                    """
                    SELECT pf.final_score, pf.ranking, pf.score_detail, pf.remark,
                           pf.created_at, pf.updated_at, bc.id AS company_id
                    FROM project_feedbacks pf
                    JOIN bidding_projects bp ON bp.id = pf.project_id
                    JOIN bidding_companies bc ON bc.project_id = bp.id
                    WHERE bc.id = (
                        SELECT MIN(id) FROM bidding_companies WHERE project_id = bp.id
                    )
                    """
                )
            ).fetchall()
            for row in rows:
                conn.execute(
                    text(
                        """
                        INSERT OR IGNORE INTO company_feedbacks
                        (company_id, final_score, ranking, score_detail, remark, created_at, updated_at)
                        VALUES (:company_id, :final_score, :ranking, :score_detail, :remark, :created_at, :updated_at)
                        """
                    ),
                    {
                        "company_id": row.company_id,
                        "final_score": row.final_score,
                        "ranking": row.ranking,
                        "score_detail": row.score_detail,
                        "remark": row.remark,
                        "created_at": row.created_at,
                        "updated_at": row.updated_at,
                    },
                )
            conn.execute(text("DROP TABLE project_feedbacks"))

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "company_feedbacks_v1"},
        )


def _migrate_bid_analysis_status() -> None:
    """为投标文件补充分析状态字段。"""
    inspector = inspect(engine)
    if "project_attachments" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "bid_analysis_status_v1"},
        ).fetchone()
        if marker:
            return

        columns = {col["name"] for col in inspector.get_columns("project_attachments")}
        if "analysis_status" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE project_attachments "
                    "ADD COLUMN analysis_status BOOLEAN NOT NULL DEFAULT 0"
                )
            )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "bid_analysis_status_v1"},
        )


def _migrate_third_party_sync_status() -> None:
    """Add third-party sync status to bidding projects."""
    inspector = inspect(engine)
    if "bidding_projects" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "third_party_sync_status_v1"},
        ).fetchone()
        if marker:
            return

        columns = {col["name"] for col in inspector.get_columns("bidding_projects")}
        if "third_party_sync_status" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE bidding_projects "
                    "ADD COLUMN third_party_sync_status VARCHAR(32) NOT NULL DEFAULT 'unsynced'"
                )
            )
        conn.execute(
            text(
                "UPDATE bidding_projects "
                "SET third_party_sync_status = 'unsynced' "
                "WHERE third_party_sync_status IS NULL"
            )
        )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "third_party_sync_status_v1"},
        )


def _migrate_bid_file_sync_and_report_fields() -> None:
    """为投标文件版本补充三方同步状态和报告文件字段。"""
    inspector = inspect(engine)
    if "project_attachments" not in inspector.get_table_names():
        return

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS app_migrations (
                    name VARCHAR(128) PRIMARY KEY,
                    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
        )
        marker = conn.execute(
            text("SELECT name FROM app_migrations WHERE name = :name"),
            {"name": "bid_file_sync_report_fields_v1"},
        ).fetchone()
        if marker:
            return

        columns = {col["name"] for col in inspector.get_columns("project_attachments")}
        if "third_party_sync_status" not in columns:
            conn.execute(
                text(
                    "ALTER TABLE project_attachments "
                    "ADD COLUMN third_party_sync_status VARCHAR(32) NOT NULL DEFAULT 'unsynced'"
                )
            )
        if "report_original_name" not in columns:
            conn.execute(text("ALTER TABLE project_attachments ADD COLUMN report_original_name VARCHAR(255)"))
        if "report_stored_name" not in columns:
            conn.execute(text("ALTER TABLE project_attachments ADD COLUMN report_stored_name VARCHAR(255)"))
        if "report_content_type" not in columns:
            conn.execute(text("ALTER TABLE project_attachments ADD COLUMN report_content_type VARCHAR(128)"))
        if "report_size_bytes" not in columns:
            conn.execute(text("ALTER TABLE project_attachments ADD COLUMN report_size_bytes INTEGER"))
        if "report_uploaded_at" not in columns:
            conn.execute(text("ALTER TABLE project_attachments ADD COLUMN report_uploaded_at DATETIME"))

        table_names = set(inspector.get_table_names())
        if "bidding_projects" in table_names:
            project_columns = {col["name"] for col in inspector.get_columns("bidding_projects")}
            if "third_party_sync_status" in project_columns:
                conn.execute(
                    text(
                        """
                        UPDATE project_attachments
                        SET third_party_sync_status = COALESCE(
                            (
                                SELECT bidding_projects.third_party_sync_status
                                FROM bidding_projects
                                WHERE bidding_projects.id = project_attachments.project_id
                            ),
                            'unsynced'
                        )
                        WHERE attachment_type = 'bid_doc'
                        """
                    )
                )

        conn.execute(
            text("INSERT INTO app_migrations (name) VALUES (:name)"),
            {"name": "bid_file_sync_report_fields_v1"},
        )


def init_db() -> None:
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_legacy_projects()
    _migrate_owner_column()
    _migrate_project_attachments_table()
    _migrate_bidding_companies()
    _migrate_bid_version_numbers()
    _migrate_company_feedbacks()
    _migrate_bid_analysis_status()
    _migrate_third_party_sync_status()
    _migrate_bid_file_sync_and_report_fields()
    _migrate_operation_log_timezone()
    _migrate_attachment_timezone()
    _migrate_bidding_entity_timezone()
    _seed_users()
