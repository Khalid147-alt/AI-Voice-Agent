import asyncio
from datetime import datetime

from fastapi import APIRouter, Request, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, AsyncSessionLocal
from models.call import Call
from models.agent import Agent
from services.analysis_pipeline import analyze_transcript
from ws.manager import ws_manager

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


async def _get_call_by_vapi_id(db: AsyncSession, vapi_call_id: str) -> Call | None:
    if not vapi_call_id:
        return None
    return (
        await db.execute(select(Call).where(Call.vapi_call_id == vapi_call_id))
    ).scalar_one_or_none()


@router.post("/vapi")
async def handle_vapi_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    message = body.get("message", {})
    msg_type = message.get("type")
    call_obj = message.get("call", {}) or {}
    vapi_call_id = call_obj.get("id")

    if msg_type == "assistant-request":
        # Dynamic inbound routing: return the first active agent's assistant id.
        agent = (
            await db.execute(select(Agent).where(Agent.status == "active"))
        ).scalars().first()
        if agent and agent.vapi_assistant_id:
            return {"assistantId": agent.vapi_assistant_id}
        return {"error": "No assistant configured"}

    if msg_type == "status-update":
        new_status = message.get("status")
        call = await _get_call_by_vapi_id(db, vapi_call_id)
        if call:
            call.status = new_status or call.status
            if new_status == "in-progress" and not call.started_at:
                call.started_at = datetime.utcnow()
            await db.commit()
        await ws_manager.broadcast(
            {"type": "call_status", "call_id": vapi_call_id, "status": new_status}
        )
        return {"status": "ok"}

    if msg_type == "transcript":
        entry = {
            "role": message.get("role"),
            "content": message.get("transcript"),
            "timestamp": message.get("timestamp") or message.get("secondsFromStart"),
        }
        await ws_manager.broadcast(
            {"type": "transcript_chunk", "call_id": vapi_call_id, "entry": entry}
        )
        return {"status": "ok"}

    if msg_type == "end-of-call-report":
        await _process_end_of_call(db, message)
        return {"status": "ok"}

    if msg_type == "tool-calls":
        tool_calls = message.get("toolCallList") or message.get("toolCalls") or [{}]
        tool_call = tool_calls[0]
        result = await _handle_tool_call(db, tool_call)
        return {"results": [{"toolCallId": tool_call.get("id"), "result": result}]}

    return {"status": "ok"}


@router.post("/tool-call")
async def handle_tool_call_endpoint(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
    message = body.get("message", {})
    tool_calls = message.get("toolCallList") or message.get("toolCalls") or [{}]
    tool_call = tool_calls[0]
    result = await _handle_tool_call(db, tool_call)
    return {"results": [{"toolCallId": tool_call.get("id"), "result": result}]}


async def _handle_tool_call(db: AsyncSession, tool_call: dict) -> str:
    fn = tool_call.get("function", {}) or {}
    name = fn.get("name")
    if name == "book_appointment":
        args = fn.get("arguments", {})
        if isinstance(args, str):
            import json

            try:
                args = json.loads(args)
            except Exception:
                args = {}
        who = args.get("name", "the prospect")
        when = args.get("preferred_time", "a time that works")
        await ws_manager.broadcast({"type": "appointment_booked", "name": who})
        return f"Appointment booked for {who} at {when}. A calendar invite has been sent."
    return "ok"


async def _process_end_of_call(db: AsyncSession, message: dict):
    call_data = message.get("call", {}) or {}
    vapi_call_id = call_data.get("id")
    call = await _get_call_by_vapi_id(db, vapi_call_id)
    if not call:
        return

    artifact = message.get("artifact", {}) or {}
    analysis = message.get("analysis", {}) or {}

    call.status = "completed"

    started = call_data.get("startedAt")
    ended = call_data.get("endedAt")
    if started and ended:
        try:
            s = datetime.fromisoformat(started.replace("Z", "+00:00"))
            e = datetime.fromisoformat(ended.replace("Z", "+00:00"))
            call.duration_seconds = int((e - s).total_seconds())
            call.started_at = s.replace(tzinfo=None)
            call.ended_at = e.replace(tzinfo=None)
        except Exception:
            pass

    costs = call_data.get("costs") or message.get("costs") or []
    if costs:
        call.cost_usd = costs[-1].get("cost") if isinstance(costs[-1], dict) else None
    if call.cost_usd is None:
        call.cost_usd = message.get("cost")

    call.transcript = artifact.get("messages") or message.get("messages") or []
    call.recording_url = artifact.get("recordingUrl") or message.get("recordingUrl")
    call.summary = analysis.get("summary")
    call.analysis = analysis.get("structuredData")
    call.success = str(analysis.get("successEvaluation")).lower() in ("true", "pass")

    if isinstance(call.analysis, dict):
        call.interest_level = call.analysis.get("interest_level")

    await db.commit()

    # Fire-and-forget LangGraph post-call enrichment.
    asyncio.create_task(_run_post_call_analysis(call.id))

    await ws_manager.broadcast({"type": "call_completed", "call_id": call.id})


async def _run_post_call_analysis(call_id: str):
    async with AsyncSessionLocal() as db:
        call = (await db.execute(select(Call).where(Call.id == call_id))).scalar_one_or_none()
        if not call:
            return
        enriched = analyze_transcript(call_id, call.transcript or [])
        merged = dict(call.analysis or {})
        merged.update({k: v for k, v in enriched.items() if v is not None})
        call.analysis = merged
        if enriched.get("lead_score") is not None and not call.interest_level:
            score = enriched["lead_score"]
            call.interest_level = "hot" if score >= 75 else "warm" if score >= 45 else "cold"
        await db.commit()
        await ws_manager.broadcast({"type": "analysis_ready", "call_id": call_id})
