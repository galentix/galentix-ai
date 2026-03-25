"""
Galentix AI - Database Configuration
Optimized with connection pooling.
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy import event
from .config import settings

POOL_SIZE = int(os.environ.get('DB_POOL_SIZE', '10'))
POOL_MAX_OVERFLOW = int(os.environ.get('DB_POOL_OVERFLOW', '20'))
POOL_TIMEOUT = int(os.environ.get('DB_POOL_TIMEOUT', '30'))

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    pool_size=POOL_SIZE,
    max_overflow=POOL_MAX_OVERFLOW,
    pool_timeout=POOL_TIMEOUT,
    pool_pre_ping=True,
    pool_recycle=3600,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_db():
    """Dependency to get database session with connection pooling."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()