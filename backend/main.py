from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from database import init_db
from seed import seed_if_empty
from ws.manager import ws_manager
from services.scheduler import start_scheduler, shutdown_scheduler

from routers import agents, calls, contacts, campaigns, webhooks, analytics
from routers import settings_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_if_empty()
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="VoiceDesk API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:3000", "http://127.0.0.1:3000"],
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
    return {"data": {"service": "VoiceDesk API", "demo_mode": settings.demo_mode}, "error": None}


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
