"""APScheduler-backed outbound campaign runner.

Processes campaigns in batches, dispatching a real VAPI call per contact using
the campaign agent's synced assistant and the configured VAPI phone number.
"""
import asyncio
import logging
from datetime import datetime, timezone
from uuid import uuid4

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models.agent import Agent
from models.campaign import Campaign
from models.contact import Contact
from models.call import Call
from services.vapi_client import vapi_client
from ws.manager import ws_manager

logger = logging.getLogger("voicedesk.scheduler")

scheduler = AsyncIOScheduler(timezone="UTC")


async def run_campaign_batch(campaign_id: str) -> None:
    """Run one batch of a campaign's outbound calls."""
    async with AsyncSessionLocal() as db:
        campaign = (
            await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        ).scalar_one_or_none()
        if not campaign or campaign.status not in ("running", "scheduled"):
            return

        # Resolve the campaign agent's VAPI assistant once per batch.
        agent = (
            await db.execute(select(Agent).where(Agent.id == campaign.agent_id))
        ).scalar_one_or_none()
        assistant_id = agent.vapi_assistant_id if agent else None

        # Cannot dispatch real calls without an assistant + phone number — halt cleanly.
        if not assistant_id or not settings.phone_ready:
            campaign.status = "paused"
            await db.commit()
            reason = (
                "agent has no VAPI assistant" if not assistant_id
                else "VAPI_PHONE_NUMBER_ID is not configured"
            )
            logger.warning("Campaign %s paused: %s.", campaign_id, reason)
            await ws_manager.broadcast(
                {"type": "campaign_error", "campaign_id": campaign_id, "reason": reason}
            )
            return

        campaign.status = "running"
        if not campaign.started_at:
            campaign.started_at = datetime.utcnow()

        remaining = [cid for cid in (campaign.contact_ids or [])][campaign.calls_made:]
        batch = remaining[: campaign.calls_per_batch]

        for contact_id in batch:
            contact = (
                await db.execute(select(Contact).where(Contact.id == contact_id))
            ).scalar_one_or_none()
            if not contact or not contact.phone:
                campaign.calls_made += 1
                continue

            try:
                result = await vapi_client.create_call(
                    {
                        "assistantId": assistant_id,
                        "phoneNumberId": settings.VAPI_PHONE_NUMBER_ID,
                        "customer": {"number": contact.phone},
                    }
                )
                call = Call(
                    vapi_call_id=result.get("id"),
                    agent_id=campaign.agent_id,
                    contact_id=contact.id,
                    campaign_id=campaign.id,
                    direction="outbound",
                    status=result.get("status", "queued"),
                    phone_number=contact.phone,
                )
                db.add(call)
                contact.last_called_at = datetime.utcnow()
                contact.status = "contacted"
            except Exception as exc:
                logger.warning("Campaign %s: call to %s failed: %s", campaign_id, contact.phone, exc)
            finally:
                campaign.calls_made += 1

            await ws_manager.broadcast(
                {"type": "campaign_progress", "campaign_id": campaign.id, "calls_made": campaign.calls_made}
            )
            await asyncio.sleep(campaign.delay_between_calls_seconds)

        if campaign.calls_made >= len(campaign.contact_ids or []):
            campaign.status = "completed"
            campaign.completed_at = datetime.utcnow()
        await db.commit()

        # Schedule next batch if not finished (run ASAP, no date trigger).
        if campaign.status == "running":
            scheduler.add_job(
                run_campaign_batch,
                args=[campaign_id],
                id=f"campaign-{campaign_id}-{uuid4().hex[:6]}",
                misfire_grace_time=120,
            )


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()


def shutdown_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


def schedule_campaign(campaign_id: str, run_date: datetime | None = None) -> None:
    if run_date is not None:
        # Future scheduled run. Treat the naive datetime as UTC.
        scheduler.add_job(
            run_campaign_batch,
            "date",
            run_date=run_date.replace(tzinfo=timezone.utc)
            if run_date.tzinfo is None
            else run_date,
            args=[campaign_id],
            id=f"campaign-{campaign_id}-start",
            replace_existing=True,
            misfire_grace_time=300,
        )
    else:
        # Run as soon as possible.
        scheduler.add_job(
            run_campaign_batch,
            args=[campaign_id],
            id=f"campaign-{campaign_id}-start",
            replace_existing=True,
            misfire_grace_time=300,
        )
