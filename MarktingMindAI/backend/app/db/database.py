from contextlib import contextmanager
from typing import Generator, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

_engine: Optional[Engine] = None
_SessionLocal: Optional[sessionmaker] = None


def _normalize_database_url(database_url: str) -> str:
    # Leave SQLite and already-normalized URLs untouched
    if database_url.startswith("sqlite"):
        return database_url
    if database_url.startswith("postgres://"):
        return database_url.replace("postgres://", "postgresql+psycopg://", 1)
    if database_url.startswith("postgresql://") and "+psycopg" not in database_url:
        return database_url.replace("postgresql://", "postgresql+psycopg://", 1)
    return database_url


def get_engine() -> Optional[Engine]:
    global _engine
    settings = get_settings()
    if not settings.database_url:
        return None
    if _engine is None:
        url = _normalize_database_url(settings.database_url)
        connect_args = {"check_same_thread": False} if url.startswith("sqlite") else {}
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            future=True,
            connect_args=connect_args,
        )
    return _engine


def get_session_factory() -> Optional[sessionmaker]:
    global _SessionLocal
    engine = get_engine()
    if engine is None:
        return None
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
    return _SessionLocal


@contextmanager
def session_scope() -> Generator[Session, None, None]:
    factory = get_session_factory()
    if factory is None:
        raise RuntimeError("DATABASE_URL is not configured.")
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_sql_tables() -> None:
    """Create all SQL tables if they do not already exist."""
    from app.db.models import Base
    engine = get_engine()
    if engine is None:
        return
    Base.metadata.create_all(bind=engine)
    _apply_schema_patches(engine)


def _apply_schema_patches(engine: Engine) -> None:
    """Lightweight column patches for existing PostgreSQL databases."""
    if (get_settings().database_url or "").startswith("sqlite"):
        return
    patches = [
        "ALTER TABLE campaign_settings ADD COLUMN IF NOT EXISTS smtp_username VARCHAR(255)",
        "ALTER TABLE campaign_settings ADD COLUMN IF NOT EXISTS smtp_password VARCHAR(255)",
        "ALTER TABLE campaign_settings ADD COLUMN IF NOT EXISTS email_delay_seconds INTEGER DEFAULT 3",
        "ALTER TABLE campaign_settings ADD COLUMN IF NOT EXISTS options_json JSONB DEFAULT '{}'::jsonb",
        "ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS description VARCHAR(255)",
    ]
    try:
        with engine.begin() as connection:
            for statement in patches:
                connection.execute(text(statement))
    except SQLAlchemyError:
        pass


@contextmanager
def database_connection():
    engine = get_engine()
    if engine is None:
        yield None
        return

    with engine.connect() as connection:
        yield connection


def database_status() -> dict[str, str]:
    engine = get_engine()
    settings = get_settings()
    if engine is None:
        return {"status": "not_configured", "message": "DATABASE_URL is not set."}

    db_type = "SQLite" if (settings.database_url or "").startswith("sqlite") else "PostgreSQL"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return {"status": "available", "message": f"{db_type} connection succeeded."}
    except SQLAlchemyError as exc:
        return {"status": "error", "message": str(exc)}
