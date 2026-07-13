import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from ws.manager import ws_manager
from services.scheduler import start_scheduler, shutdown_scheduler

from routers import agents, calls, contacts, campaigns, webhooks, analytics
from routers import settings_router

logger = logging.getLogger("voicedesk")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    missing = settings.missing_required()
    if missing:
        logger.warning(
            "VoiceDesk starting WITHOUT required keys: %s. "
            "Configure them in backend/.env for full functionality.",
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

    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="VoiceDesk API", version="1.0.0", lifespan=lifespan)

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


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        while True:
            await ws.receive_text()  # keep-alive; client may ping
    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)
