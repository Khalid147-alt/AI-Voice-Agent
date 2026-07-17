import asyncio

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from sqlalchemy.pool import NullPool

from config import settings

Base = declarative_base()


def _build_engine():
    """Create the async engine, tuned for the target database.

    On serverless (Vercel) every function invocation is a fresh, short-lived
    process, so a long-lived connection pool is useless and can exhaust the
    database's connection limit. NullPool opens a connection per checkout and
    closes it on release. For Postgres we also enable SSL (required by Vercel
    Postgres / Neon) and disable statement caching, which asyncpg + PgBouncer
    do not tolerate.
    """
    url = settings.database_url

    if url.startswith("postgresql"):
        return create_async_engine(
            url,
            echo=False,
            future=True,
            poolclass=NullPool,
            connect_args={
                "ssl": True,
                # PgBouncer (transaction pooling) breaks asyncpg prepared-
                # statement caching; disabling it keeps queries safe there.
                "statement_cache_size": 0,
            },
        )

    # SQLite (local dev / tests).
    return create_async_engine(url, echo=False, future=True)


engine = _build_engine()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create all tables. Imports models so they register on Base.metadata."""
    # Import models so they are registered with Base before create_all.
    import models.agent  # noqa: F401
    import models.call  # noqa: F401
    import models.contact  # noqa: F401
    import models.campaign  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


# On Vercel's serverless Python runtime the ASGI lifespan (startup) event is not
# guaranteed to run, so we cannot rely on it alone to create tables. This guard
# runs init_db() at most once per process, lazily, on the first request that
# needs the DB (see the middleware in main.py). It's a no-op after the first run.
_init_lock = asyncio.Lock()
_initialized = False


async def ensure_db_ready() -> None:
    """Idempotently ensure tables exist. Safe to call on every request."""
    global _initialized
    if _initialized:
        return
    async with _init_lock:
        if _initialized:
            return
        await init_db()
        _initialized = True
