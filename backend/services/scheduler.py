"""APScheduler-backed outbound campaign runner.

Processes campaigns in batches. In demo mode (no VAPI key) it simulates calls by
creating local Call rows with realistic mock outcomes so the dashboard shows
activity end-to-end.
"""
import asyncio
import random
from datetime import datetime, timezone
from uuid import uuid4

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models.campaign import Campaign
from models.contact import Contact
from models.call import Call
from services.vapi_client import vapi_client, build_assistant_config  # noqa: F401
from services.analysis_pipeline import analyze_transcript
from ws.manager import ws_manager

scheduler = AsyncIOScheduler(timezone="UTC")

_MOCK_TRANSCRIPT = [
    {"role": "assistant", "content": "Hi, this is Sarah from VoiceDesk. Is now a good time?", "timestamp": 0},
    {"role": "user", "content": "Sure, what's this about?", "timestamp": 3200},
    {"role": "assistant", "content": "We help SaaS teams automate phone outreach. Are you handling outbound calls manually today?", "timestamp": 6400},
    {"role": "user", "content": "Yeah, it's a lot of work honestly.", "timestamp": 11000},
    {"role": "assistant", "content": "I'd love to show you a quick demo. Could I book 20 minutes this week?", "timestamp": 15000},
    {"role": "user", "content": "Okay, that works.", "timestamp": 19000},
]


async def _simulate_call(db, campaign: Campaign, contact: Contact) -> Call:
    """Create a completed mock call for demo mode."""
    answered = random.random() > 0.2
    interest = random.choice(["hot", "warm", "warm", "cold"])
    duration = random.randint(45, 300) if answered else 0
    transcript = _MOCK_TRANSCRIPT if answered else []
    analysis = analyze_transcript(str(uuid4()), transcript) if answered else {}

    call = Call(
        agent_id=campaign.agent_id,
        contact_id=contact.id,
        campaign_id=campaign.id,
        direction="outbound",
        status="completed" if answered else "no-answer",
        phone_number=contact.phone,
        duration_seconds=duration,
        cost_usd=round(duration / 60 * 0.09, 3) if answered else 0.0,
        transcript=transcript,
        summary="Prospect showed interest and agreed to a demo." if answered else None,
        analysis=analysis,
        interest_level=interest if answered else None,
        success=bool(answered and interest == "hot"),
        started_at=datetime.utcnow(),
        ended_at=datetime.utcnow(),
    )
    db.add(call)
    contact.last_called_at = datetime.utcnow()
    contact.status = "qualified" if (answered and interest == "hot") else "contacted"
    return call


async def run_campaign_batch(campaign_id: str) -> None:
    """Run one batch of a campaign's outbound calls."""
    async with AsyncSessionLocal() as db:
        campaign = (
            await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        ).scalar_one_or_none()
        if not campaign or campaign.status not in ("running", "scheduled"):
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
            if not contact:
                campaign.calls_made += 1
                continue

            if settings.demo_mode:
                call = await _simulate_call(db, campaign, contact)
                campaign.calls_made += 1
                if call.status == "completed":
                    campaign.calls_answered += 1
                if call.success:
                    campaign.leads_qualified += 1
            else:
                try:
                    payload = {
                        "assistantId": None,  # resolved by router before scheduling
                        "phoneNumberId": settings.VAPI_PHONE_NUMBER_ID,
                        "customer": {"number": contact.phone},
                    }
                    result = await vapi_client.create_call(payload)
                    call = Call(
                        vapi_call_id=result.get("id"),
                        agent_id=campaign.agent_id,
                        contact_id=contact.id,
                        campaign_id=campaign.id,
                        direction="outbound",
                        status="queued",
                        phone_number=contact.phone,
                    )
                    db.add(call)
                    campaign.calls_made += 1
                except Exception:
                    campaign.calls_made += 1

            await ws_manager.broadcast(
                {"type": "campaign_progress", "campaign_id": campaign.id, "calls_made": campaign.calls_made}
            )
            await asyncio.sleep(min(campaign.delay_between_calls_seconds, 2) if settings.demo_mode else campaign.delay_between_calls_seconds)

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
