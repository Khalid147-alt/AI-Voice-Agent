from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from config import settings
from database import get_db
from models.agent import Agent
from models.call import Call
from models.contact import Contact
from schemas.call import CallCreate, CallOut
from services.vapi_client import vapi_client
from ws.manager import ws_manager
from utils import envelope

router = APIRouter(prefix="/api/calls", tags=["calls"])


async def _agent_name_map(db: AsyncSession) -> dict:
    rows = (await db.execute(select(Agent.id, Agent.name))).all()
    return {r[0]: r[1] for r in rows}


def _serialize(call: Call, agent_names: dict) -> dict:
    out = CallOut.model_validate(call).model_dump(mode="json")
    out["agent_name"] = agent_names.get(call.agent_id)
    return out


@router.get("")
async def list_calls(
    status: Optional[str] = None,
    direction: Optional[str] = None,
    agent_id: Optional[str] = None,
    interest_level: Optional[str] = None,
    limit: int = Query(200, le=500),
    db: AsyncSession = Depends(get_db),
):
    query = select(Call).order_by(Call.created_at.desc()).limit(limit)
    if status:
        query = query.where(Call.status == status)
    if direction:
        query = query.where(Call.direction == direction)
    if agent_id:
        query = query.where(Call.agent_id == agent_id)
    if interest_level:
        query = query.where(Call.interest_level == interest_level)

    rows = (await db.execute(query)).scalars().all()
    names = await _agent_name_map(db)
    return envelope([_serialize(c, names) for c in rows])


@router.get("/{call_id}")
async def get_call(call_id: str, db: AsyncSession = Depends(get_db)):
    call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
    if not call:
        raise HTTPException(status_code=404, detail="Call not found")
    names = await _agent_name_map(db)
    return envelope(_serialize(call, names))


@router.post("")
async def create_call(payload: CallCreate, db: AsyncSession = Depends(get_db)):
    agent = (await db.execute(select(Agent).where(Agent.id == payload.agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    phone = payload.phone_number
    if payload.contact_id:
        contact = (
            await db.execute(select(Contact).where(Contact.id == payload.contact_id))
        ).scalar_one_or_none()
        if contact:
            phone = phone or contact.phone

    # An outbound phone call requires a synced assistant, a destination number,
    # and a VAPI phone number to dial from. Validate up front with clear errors.
    if not agent.vapi_assistant_id:
        raise HTTPException(
            status_code=409,
            detail="Agent is not synced to VAPI yet. Save/update the agent so it gets a VAPI assistant, then retry.",
        )
    if not phone:
        raise HTTPException(
            status_code=422,
            detail="A destination phone number (or a contact with a phone) is required for an outbound call.",
        )
    if not settings.phone_ready:
        raise HTTPException(
            status_code=409,
            detail="No VAPI phone number configured. Import a number in the VAPI dashboard and set VAPI_PHONE_NUMBER_ID.",
        )

    call = Call(
        agent_id=payload.agent_id,
        contact_id=payload.contact_id,
        campaign_id=payload.campaign_id,
        direction=payload.direction or "outbound",
        phone_number=phone,
        status="queued",
    )
    db.add(call)
    await db.flush()

    try:
        result = await vapi_client.create_call(
            {
                "assistantId": agent.vapi_assistant_id,
                "phoneNumberId": settings.VAPI_PHONE_NUMBER_ID,
                "customer": {"number": phone},
            }
        )
        call.vapi_call_id = result.get("id")
        call.status = result.get("status", "queued")
    except Exception as exc:
        await db.commit()
        return envelope(
            CallOut.model_validate(call).model_dump(mode="json"),
            error=f"Call saved but VAPI dispatch failed: {exc}",
        )

    await db.commit()
    await ws_manager.broadcast({"type": "call_created", "call_id": call.id})
    names = await _agent_name_map(db)
    return envelope(_serialize(call, names))
