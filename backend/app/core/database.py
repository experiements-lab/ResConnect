from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from app.core.config import settings


engine = create_async_engine(
    settings.database_url,
    echo=False,
    # Supabase's transaction-mode pooler (PgBouncer) multiplexes many client
    # connections onto a small set of backend Postgres connections, and two
    # collision sources show up against it:
    #  1. SQLAlchemy's own query preparation always names statements itself
    #     (sequentially, e.g. __asyncpg_stmt_1__, _2__, ...), so two app
    #     connections sharing the same backend can generate the same name.
    #     A UUID-based name func makes every statement globally unique —
    #     SQLAlchemy's documented fix (see sqlalchemy/sqlalchemy#6467).
    #  2. asyncpg itself also prepares statements internally (e.g. the
    #     JSON/JSONB codec type-introspection queries it runs on every new
    #     connection via on_connect), using its own auto-naming that the
    #     name func above has no hook into. statement_cache_size=0 disables
    #     asyncpg's statement cache, which makes it fall back to anonymous
    #     (unnamed) statements for these internal queries instead.
    # NullPool is required alongside both so connections (and any statements
    # still named on them) don't pile up unreleased.
    poolclass=NullPool,
    connect_args={
        "prepared_statement_name_func": lambda: f"__asyncpg_{uuid4()}__",
        "statement_cache_size": 0,
    },
)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
