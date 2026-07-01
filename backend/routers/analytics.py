from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.call import Call
from models.agent import Agent
from utils import envelope

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
async def overview(db: AsyncSession = Depends(get_db)):
    calls = (await db.execute(select(Call))).scalars().all()
    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    total_calls = len(calls)
    total_cost = round(sum(c.cost_usd or 0 for c in calls), 2)
    durations = [c.duration_seconds for c in calls if c.duration_seconds]
    avg_duration = round(sum(durations) / len(durations)) if durations else 0
    completed = [c for c in calls if c.status == "completed"]
    successes = [c for c in completed if c.success]
    success_rate = round(len(successes) / len(completed) * 100, 1) if completed else 0.0

    this_week = len([c for c in calls if c.created_at and c.created_at >= week_ago])
    last_week = len(
        [c for c in calls if c.created_at and two_weeks_ago <= c.created_at < week_ago]
    )

    live = len([c for c in calls if c.status in ("in-progress", "ringing", "queued")])
    hot_today = len(
        [
            c
            for c in calls
            if c.interest_level == "hot"
            and c.created_at
            and c.created_at.date() == now.date()
        ]
    )
    calls_today = len([c for c in calls if c.created_at and c.created_at.date() == now.date()])
    cost_today = round(
        sum(c.cost_usd or 0 for c in calls if c.created_at and c.created_at.date() == now.date()),
        2,
    )

    return envelope(
        {
            "total_calls": total_calls,
            "total_cost": total_cost,
            "avg_duration_seconds": avg_duration,
            "success_rate": success_rate,
            "calls_this_week": this_week,
            "calls_last_week": last_week,
            "live_calls": live,
            "hot_leads_today": hot_today,
            "calls_today": calls_today,
            "cost_today": cost_today,
        }
    )


@router.get("/call-volume")
async def call_volume(days: int = Query(30, le=90), db: AsyncSession = Depends(get_db)):
    calls = (await db.execute(select(Call))).scalars().all()
    now = datetime.utcnow().date()
    buckets = {(now - timedelta(days=i)): 0 for i in range(days)}
    for c in calls:
        if c.created_at:
            d = c.created_at.date()
            if d in buckets:
                buckets[d] += 1
    series = [
        {"date": d.isoformat(), "calls": buckets[d]}
        for d in sorted(buckets.keys())
    ]
    return envelope(series)


@router.get("/interest-breakdown")
async def interest_breakdown(db: AsyncSession = Depends(get_db)):
    calls = (await db.execute(select(Call))).scalars().all()
    counts = {"hot": 0, "warm": 0, "cold": 0}
    for c in calls:
        if c.interest_level in counts:
            counts[c.interest_level] += 1
    return envelope([{"level": k, "count": v} for k, v in counts.items()])


@router.get("/agent-performance")
async def agent_performance(db: AsyncSession = Depends(get_db)):
    agents = (await db.execute(select(Agent))).scalars().all()
    calls = (await db.execute(select(Call))).scalars().all()
    by_agent = defaultdict(list)
    for c in calls:
        by_agent[c.agent_id].append(c)

    result = []
    for a in agents:
        ac = by_agent.get(a.id, [])
        completed = [c for c in ac if c.status == "completed"]
        successes = [c for c in completed if c.success]
        durations = [c.duration_seconds for c in ac if c.duration_seconds]
        result.append(
            {
                "agent_id": a.id,
                "agent_name": a.name,
                "calls": len(ac),
                "success_rate": round(len(successes) / len(completed) * 100, 1) if completed else 0.0,
                "avg_duration_seconds": round(sum(durations) / len(durations)) if durations else 0,
            }
        )
    return envelope(result)


@router.get("/calls-by-hour")
async def calls_by_hour(db: AsyncSession = Depends(get_db)):
    calls = (await db.execute(select(Call))).scalars().all()
    buckets = {h: 0 for h in range(24)}
    for c in calls:
        ref = c.started_at or c.created_at
        if ref:
            buckets[ref.hour] += 1
    return envelope([{"hour": h, "calls": buckets[h]} for h in range(24)])


@router.get("/cost-trend")
async def cost_trend(days: int = Query(30, le=90), db: AsyncSession = Depends(get_db)):
    calls = (await db.execute(select(Call))).scalars().all()
    now = datetime.utcnow().date()
    buckets = {(now - timedelta(days=i)): 0.0 for i in range(days)}
    for c in calls:
        if c.created_at and c.cost_usd:
            d = c.created_at.date()
            if d in buckets:
                buckets[d] += c.cost_usd
    series = [
        {"date": d.isoformat(), "cost": round(buckets[d], 2)}
        for d in sorted(buckets.keys())
    ]
    return envelope(series)
