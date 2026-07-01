from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.agent import Agent
from models.campaign import Campaign
from schemas.campaign import CampaignCreate, CampaignUpdate, CampaignOut
from services.scheduler import schedule_campaign
from utils import envelope

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


async def _agent_name_map(db: AsyncSession) -> dict:
    rows = (await db.execute(select(Agent.id, Agent.name))).all()
    return {r[0]: r[1] for r in rows}


def _serialize(c: Campaign, names: dict) -> dict:
    out = CampaignOut.model_validate(c).model_dump(mode="json")
    out["agent_name"] = names.get(c.agent_id)
    return out


@router.get("")
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Campaign).order_by(Campaign.created_at.desc()))).scalars().all()
    names = await _agent_name_map(db)
    return envelope([_serialize(c, names) for c in rows])


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    names = await _agent_name_map(db)
    return envelope(_serialize(c, names))


@router.post("")
async def create_campaign(payload: CampaignCreate, db: AsyncSession = Depends(get_db)):
    campaign = Campaign(
        name=payload.name,
        agent_id=payload.agent_id,
        contact_ids=payload.contact_ids,
        calls_per_batch=payload.calls_per_batch or 5,
        delay_between_calls_seconds=payload.delay_between_calls_seconds or 30,
        scheduled_at=payload.scheduled_at,
        total_contacts=len(payload.contact_ids or []),
        status="draft",
    )
    if payload.run_now:
        campaign.status = "running"
    elif payload.scheduled_at:
        campaign.status = "scheduled"

    db.add(campaign)
    await db.commit()

    if payload.run_now:
        schedule_campaign(campaign.id)
    elif payload.scheduled_at:
        schedule_campaign(campaign.id, payload.scheduled_at)

    names = await _agent_name_map(db)
    return envelope(_serialize(campaign, names))


@router.post("/{campaign_id}/start")
async def start_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = "running"
    if not c.started_at:
        c.started_at = datetime.utcnow()
    await db.commit()
    schedule_campaign(campaign_id)
    names = await _agent_name_map(db)
    return envelope(_serialize(c, names))


@router.post("/{campaign_id}/pause")
async def pause_campaign(campaign_id: str, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = "paused"
    await db.commit()
    names = await _agent_name_map(db)
    return envelope(_serialize(c, names))


@router.patch("/{campaign_id}")
async def update_campaign(campaign_id: str, payload: CampaignUpdate, db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(Campaign).where(Campaign.id == campaign_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(c, key, value)
    await db.commit()
    names = await _agent_name_map(db)
    return envelope(_serialize(c, names))
