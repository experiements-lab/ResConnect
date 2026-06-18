from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=False,
    # Supabase's transaction-mode pooler (PgBouncer) multiplexes many client
    # connections onto a small set of backend Postgres connections, so a named
    # prepared statement created by one client can collide with the same name
    # generated independently by another. SQLAlchemy's asyncpg dialect prepares
    # statements directly (bypassing asyncpg's own statement_cache_size knob),
    # so prepared_statement_cache_size=0 is what actually makes it use unnamed
    # statements, which can't collide. NullPool avoids reusing the same asyncpg
    # connection object across requests for the same reason.
    poolclass=NullPool,
    connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
