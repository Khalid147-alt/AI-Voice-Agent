import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import ensure_db_ready

from routers import agents, calls, contacts, campaigns, webhooks, analytics, cron
from routers import settings_router

logger = logging.getLogger("voicedesk")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Best-effort startup init for long-lived servers (local uvicorn / Docker).
    # On Vercel serverless the lifespan may not run, so the middleware below also
    # guarantees the DB is ready on the first request (ensure_db_ready is a
    # no-op after the first successful init).
    try:
        await ensure_db_ready()
    except Exception as exc:  # don't crash boot if the DB is briefly unreachable
        logger.warning("Deferred DB init to first request: %s", exc)

    missing = settings.missing_required()
    if missing:
        logger.warning(
            "VoiceDesk starting WITHOUT required keys: %s. "
            "Configure them in the environment for full functionality.",
            ", ".join(missing),
        )
    else:
        logger.info("VoiceDesk ready — VAPI and Gemini configured.")
    if not settings.phone_ready:
        logger.warning(
            "VAPI_PHONE_NUMBER_ID is not set — in-browser web calls work, "
            "but outbound phone calls and campaigns need a VAPI phone number."
        )
    if settings.BACKEND_URL.startswith("http://localhost") or settings.BACKEND_URL.startswith(
        "http://127.0.0.1"
    ):
        logger.warning(
            "BACKEND_URL is %s — VAPI cannot deliver webhooks to localhost. "
            "Set BACKEND_URL to your public/deployed URL for live transcripts and call reports.",
            settings.BACKEND_URL,
        )
    yield


app = FastAPI(title="VoiceDesk API", version="2.0.0", lifespan=lifespan)


@app.middleware("http")
async def _db_ready_middleware(request: Request, call_next):
    """Ensure DB tables exist before handling any request (serverless-safe)."""
    try:
        await ensure_db_ready()
    except Exception as exc:
        logger.warning("DB init failed for %s: %s", request.url.path, exc)
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    # Explicit origins (dev + your configured Vercel URL) plus any *.vercel.app
    # deployment (production + preview) via regex.
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(calls.router)
app.include_router(contacts.router)
app.include_router(campaigns.router)
app.include_router(webhooks.router)
app.include_router(analytics.router)
app.include_router(settings_router.router)
app.include_router(cron.router)


@app.get("/")
async def root():
    return {
        "data": {
            "service": "VoiceDesk API",
            "vapi_ready": settings.vapi_ready,
            "gemini_ready": settings.gemini_ready,
        },
        "error": None,
    }


@app.get("/health")
async def health():
    return {"data": {"status": "ok"}, "error": None}
