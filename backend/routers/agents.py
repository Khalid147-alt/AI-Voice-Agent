from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.agent import Agent
from schemas.agent import AgentCreate, AgentUpdate, AgentOut
from services.vapi_client import vapi_client, build_assistant_config
from utils import envelope

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("")
async def list_agents(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Agent).order_by(Agent.created_at.desc()))).scalars().all()
    return envelope([AgentOut.model_validate(a).model_dump(mode="json") for a in rows])


@router.get("/{agent_id}")
async def get_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    return envelope(AgentOut.model_validate(agent).model_dump(mode="json"))


@router.post("")
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(**payload.model_dump())
    db.add(agent)
    await db.flush()

    try:
        config = build_assistant_config(agent)
        result = await vapi_client.create_assistant(config)
        agent.vapi_assistant_id = result.get("id")
    except Exception as exc:
        # Don't lose the local record if VAPI sync fails; surface a soft warning so
        # the user can retry the sync via an update.
        await db.commit()
        return envelope(
            AgentOut.model_validate(agent).model_dump(mode="json"),
            error=f"Saved locally but VAPI assistant sync failed: {exc}",
        )

    await db.commit()
    return envelope(AgentOut.model_validate(agent).model_dump(mode="json"))


@router.patch("/{agent_id}")
async def update_agent(agent_id: str, payload: AgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)

    sync_error = None
    try:
        if agent.vapi_assistant_id:
            await vapi_client.update_assistant(
                agent.vapi_assistant_id, build_assistant_config(agent)
            )
        else:
            # No assistant yet (e.g. an earlier sync failed) — create it now.
            result = await vapi_client.create_assistant(build_assistant_config(agent))
            agent.vapi_assistant_id = result.get("id")
    except Exception as exc:
        sync_error = f"Saved locally but VAPI sync failed: {exc}"

    await db.commit()
    return envelope(
        AgentOut.model_validate(agent).model_dump(mode="json"), error=sync_error
    )


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, db: AsyncSession = Depends(get_db)):
    agent = (await db.execute(select(Agent).where(Agent.id == agent_id))).scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if agent.vapi_assistant_id:
        try:
            await vapi_client.delete_assistant(agent.vapi_assistant_id)
        except Exception:
            # Assistant may already be gone on VAPI's side; proceed with local delete.
            pass

    await db.delete(agent)
    await db.commit()
    return envelope({"deleted": agent_id})
