from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=False,
    # Supabase's transaction-mode pooler (PgBouncer) doesn't support asyncpg's
    # server-side prepared statement cache across pooled connections. NullPool
    # also stops SQLAlchemy from reusing the same asyncpg connection object
    # across requests, since each reuse can land on a different PgBouncer-
    # multiplexed backend connection than the one its cache was built against.
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
