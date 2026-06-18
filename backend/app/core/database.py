from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=False,
    # Supabase's transaction-mode pooler (PgBouncer) multiplexes many client
    # connections onto a small set of backend Postgres connections. asyncpg's
    # default prepared-statement names are sequential per connection
    # (__asyncpg_stmt_1__, _2__, ...), so two different connections sharing
    # the same backend can end up generating the same name. A UUID-based name
    # func makes every prepared statement globally unique so this can't
    # happen — this is SQLAlchemy's documented fix for asyncpg + PgBouncer
    # (see sqlalchemy/sqlalchemy#6467). NullPool is required alongside it so
    # connections (and their prepared statements) don't pile up unreleased.
    poolclass=NullPool,
    connect_args={"prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__"},
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
