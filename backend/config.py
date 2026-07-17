import os

from pydantic_settings import BaseSettings


def _normalize_async_db_url(url: str) -> str:
    """Return a SQLAlchemy async URL for the given database URL.

    Accepts the many shapes a Postgres URL arrives in (Vercel Postgres / Neon
    hand out `postgres://` and `postgresql://` strings) and rewrites them to the
    async `postgresql+asyncpg://` driver SQLAlchemy needs. SQLite URLs and
    already-async URLs pass through unchanged.

    asyncpg does not understand libpq query params like `sslmode` or
    `channel_binding`, so they are stripped here; SSL is negotiated via the
    engine's `connect_args` in database.py instead.
    """
    if not url:
        return url

    # Postgres: normalize scheme to the asyncpg driver.
    if url.startswith(("postgres://", "postgresql://")):
        # Split scheme from the rest so we only touch the driver name.
        rest = url.split("://", 1)[1]
        url = f"postgresql+asyncpg://{rest}"

    # Strip libpq-only query params that asyncpg rejects (sslmode, channel_binding, …).
    if url.startswith("postgresql+asyncpg://") and "?" in url:
        url = url.split("?", 1)[0]

    return url


class Settings(BaseSettings):
    VAPI_PRIVATE_KEY: str = ""
    VAPI_PUBLIC_KEY: str = ""
    VAPI_PHONE_NUMBER_ID: str = ""  # Twilio number purchased in VAPI
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    ELEVENLABS_API_KEY: str = ""

    # Database. Locally defaults to SQLite; in production set DATABASE_URL to a
    # Postgres connection string. Vercel Postgres also injects POSTGRES_URL /
    # POSTGRES_URL_NON_POOLING automatically — those are picked up in the
    # `database_url` property below without any dashboard config.
    DATABASE_URL: str = "sqlite+aiosqlite:///./voicedesk.db"

    BACKEND_URL: str = "http://localhost:8000"  # public URL, used for VAPI webhook URLs
    PORT: int = 8000

    # CORS — frontend origin (your Vercel URL in production)
    FRONTEND_URL: str = "http://localhost:3000"

    # Shared secret guarding the cron/batch endpoint. Vercel Cron sends the
    # project's CRON_SECRET as `Authorization: Bearer <secret>`; set the same
    # value here so only Vercel (or you) can trigger campaign batches.
    CRON_SECRET: str = ""

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def database_url(self) -> str:
        """The async SQLAlchemy database URL, normalized for the async driver.

        Precedence: explicit DATABASE_URL (if the user set a non-default value)
        > Vercel Postgres' non-pooling URL > Vercel Postgres' pooled URL >
        the SQLite default. The non-pooling URL is preferred for serverless
        because each invocation opens its own short-lived connection (we also
        use NullPool), so a server-side connection pooler adds no benefit.
        """
        default_sqlite = "sqlite+aiosqlite:///./voicedesk.db"
        candidate = (
            self.DATABASE_URL
            if self.DATABASE_URL and self.DATABASE_URL != default_sqlite
            else (
                os.getenv("POSTGRES_URL_NON_POOLING")
                or os.getenv("POSTGRES_URL")
                or self.DATABASE_URL
            )
        )
        return _normalize_async_db_url(candidate)

    @property
    def is_postgres(self) -> bool:
        return self.database_url.startswith("postgresql")

    @property
    def vapi_ready(self) -> bool:
        """True when a VAPI private key is configured."""
        return bool(self.VAPI_PRIVATE_KEY.strip())

    @property
    def gemini_ready(self) -> bool:
        """True when a Google Gemini API key is configured."""
        return bool(self.GOOGLE_API_KEY.strip())

    @property
    def phone_ready(self) -> bool:
        """True when a VAPI phone number id is configured (needed for phone calls)."""
        return bool(self.VAPI_PHONE_NUMBER_ID.strip())

    def missing_required(self) -> list[str]:
        """Return the list of required production settings that are not configured."""
        missing = []
        if not self.vapi_ready:
            missing.append("VAPI_PRIVATE_KEY")
        if not self.gemini_ready:
            missing.append("GOOGLE_API_KEY")
        return missing


settings = Settings()
