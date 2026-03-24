"""
Galentix AI - Database Configuration
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import event as sa_event, text as sa_text
from .config import settings

# Create async engine
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True
)


@sa_event.listens_for(engine.sync_engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enable WAL mode and relaxed sync for better concurrent performance."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

# Create async session factory
async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()


async def init_db():
    """Initialize database tables and run migrations."""
    # Import all models so their tables are registered with Base.metadata
    from app.models.user import User  # noqa: F401
    from app.models.conversation import Conversation, Message  # noqa: F401
    from app.models.document import Document  # noqa: F401
    from app.models.audit import AuditLog  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Run lightweight migrations for columns added after initial schema
        await _run_migrations(conn)


async def _run_migrations(conn):
    """Add missing columns to existing tables (safe to run multiple times)."""
    import logging
    logger = logging.getLogger(__name__)

    migrations = [
        ("conversations", "user_id", "ALTER TABLE conversations ADD COLUMN user_id VARCHAR REFERENCES users(id)"),
    ]

    for table, column, sql in migrations:
        try:
            # Check if column exists
            result = await conn.execute(sa_text(f"PRAGMA table_info({table})"))
            columns = [row[1] for row in result.fetchall()]
            if column not in columns:
                await conn.execute(sa_text(sql))
                logger.info("Migration: added %s.%s", table, column)
        except Exception as e:
            logger.warning("Migration skipped (%s.%s): %s", table, column, e)


async def get_db() -> AsyncSession:
    """Dependency to get database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
