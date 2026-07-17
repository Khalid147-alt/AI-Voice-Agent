"""Cron endpoint that drives outbound campaign pacing on Vercel.

Vercel Cron invokes `POST /api/cron/run-campaigns` on a schedule (see
backend/vercel.json) and includes the project's `CRON_SECRET` as a Bearer token.
We verify that token so the endpoint can't be triggered by arbitrary callers.
"""
import logging

from fastapi import APIRouter, Header, HTTPException

from config import settings
from services.campaign_runner import run_due_campaigns
from utils import envelope

logger = logging.getLogger("voicedesk.cron")

router = APIRouter(prefix="/api/cron", tags=["cron"])


def _authorized(authorization: str | None) -> bool:
    """Allow the request when CRON_SECRET is unset (local dev) or matches the
    Bearer token Vercel Cron sends."""
    if not settings.CRON_SECRET:
        return True
    expected = f"Bearer {settings.CRON_SECRET}"
    return authorization == expected


@router.post("/run-campaigns")
@router.get("/run-campaigns")  # Vercel Cron issues GET; allow both.
async def run_campaigns(authorization: str | None = Header(default=None)):
    if not _authorized(authorization):
        raise HTTPException(status_code=401, detail="Unauthorized")
    result = await run_due_campaigns()
    return envelope(result)
