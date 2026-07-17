"""Stateless, cron-driven outbound campaign runner.

On Vercel there is no long-lived process to host APScheduler, so campaign pacing
is driven externally by a Vercel Cron job that hits `POST /api/cron/run-campaigns`
on a fixed interval (see backend/vercel.json). Each invocation processes ONE
batch per active campaign and returns — there is no in-process `sleep` loop and
no self-rescheduling. The cron interval provides the pacing between batches; the
per-call delay within a batch is applied with a short async sleep that stays well
inside the function's execution budget.
"""
import asyncio
import logging
from datetime import datetime

from sqlalchemy import select

from config import settings
from database import AsyncSessionLocal
from models.agent import Agent
from models.campaign import Campaign
from models.contact import Contact
from models.call import Call
from services.vapi_client import vapi_client

logger = logging.getLogger("voicedesk.campaign_runner")

# Hard ceiling on how long a single batch may spend sleeping between calls, so a
# large per-call delay can never push the function past its serverless timeout.
_MAX_BATCH_SECONDS = 45


async def _run_one_batch(db, campaign: Campaign) -> int:
    """Dispatch up to `calls_per_batch` calls for a single campaign.

    Returns the number of calls dispatched. Mutates the campaign's counters and
    status on the passed-in session but does NOT commit — the caller commits.
    """
    agent = (
        await db.execute(select(Agent).where(Agent.id == campaign.agent_id))
    ).scalar_one_or_none()
    assistant_id = agent.vapi_assistant_id if agent else None

    # Cannot dispatch real calls without an assistant + phone number — halt cleanly.
    if not assistant_id or not settings.phone_ready:
        campaign.status = "paused"
        reason = (
            "agent has no VAPI assistant"
            if not assistant_id
            else "VAPI_PHONE_NUMBER_ID is not configured"
        )
        logger.warning("Campaign %s paused: %s.", campaign.id, reason)
        return 0

    campaign.status = "running"
    if not campaign.started_at:
        campaign.started_at = datetime.utcnow()

    remaining = [cid for cid in (campaign.contact_ids or [])][campaign.calls_made:]
    batch = remaining[: campaign.calls_per_batch]

    dispatched = 0
    elapsed = 0
    delay = max(0, campaign.delay_between_calls_seconds or 0)

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
            dispatched += 1
        except Exception as exc:
            logger.warning(
                "Campaign %s: call to %s failed: %s", campaign.id, contact.phone, exc
            )
        finally:
            campaign.calls_made += 1

        # Pace calls within the batch, but never exceed the batch time budget.
        if delay and contact_id != batch[-1] and elapsed + delay <= _MAX_BATCH_SECONDS:
            await asyncio.sleep(delay)
            elapsed += delay

    if campaign.calls_made >= len(campaign.contact_ids or []):
        campaign.status = "completed"
        campaign.completed_at = datetime.utcnow()

    return dispatched


async def run_campaign_once(campaign_id: str) -> dict:
    """Dispatch a single batch for one campaign immediately (best-effort).

    Used to give instant feedback when a user starts/launches a campaign, rather
    than waiting for the next cron tick. Safe to call from a request handler:
    it processes at most one batch and commits.
    """
    async with AsyncSessionLocal() as db:
        campaign = (
            await db.execute(select(Campaign).where(Campaign.id == campaign_id))
        ).scalar_one_or_none()
        if not campaign or campaign.status not in ("running", "scheduled"):
            return {"campaign_id": campaign_id, "dispatched": 0, "skipped": True}
        # An explicit launch overrides a future schedule.
        campaign.status = "running"
        dispatched = await _run_one_batch(db, campaign)
        await db.commit()
        return {
            "campaign_id": campaign_id,
            "status": campaign.status,
            "dispatched": dispatched,
            "calls_made": campaign.calls_made,
            "total": len(campaign.contact_ids or []),
        }


async def run_due_campaigns() -> dict:
    """Process one batch for every campaign that is due to run.

    A campaign is due when its status is `running`, or `scheduled` with a
    `scheduled_at` at/earlier than now. Returns a small summary dict for the
    cron endpoint response.
    """
    now = datetime.utcnow()
    processed = []

    async with AsyncSessionLocal() as db:
        campaigns = (
            await db.execute(
                select(Campaign).where(Campaign.status.in_(("running", "scheduled")))
            )
        ).scalars().all()

        for campaign in campaigns:
            if campaign.status == "scheduled":
                if campaign.scheduled_at and campaign.scheduled_at > now:
                    continue  # not yet due
                campaign.status = "running"

            dispatched = await _run_one_batch(db, campaign)
            processed.append(
                {
                    "campaign_id": campaign.id,
                    "status": campaign.status,
                    "dispatched": dispatched,
                    "calls_made": campaign.calls_made,
                    "total": len(campaign.contact_ids or []),
                }
            )

        await db.commit()

    return {"ran_at": now.isoformat(), "campaigns": processed}
