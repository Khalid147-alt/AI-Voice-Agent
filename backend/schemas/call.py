from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class CallCreate(BaseModel):
    agent_id: str
    phone_number: Optional[str] = None
    contact_id: Optional[str] = None
    campaign_id: Optional[str] = None
    direction: Optional[str] = "outbound"


class CallOut(BaseModel):
    id: str
    vapi_call_id: Optional[str] = None
    agent_id: Optional[str] = None
    contact_id: Optional[str] = None
    campaign_id: Optional[str] = None
    direction: str = "outbound"
    status: str = "queued"
    phone_number: str = ""
    duration_seconds: Optional[int] = None
    cost_usd: Optional[float] = None
    transcript: Optional[Any] = None
    summary: Optional[str] = None
    analysis: Optional[Any] = None
    recording_url: Optional[str] = None
    interest_level: Optional[str] = None
    success: Optional[bool] = None
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    created_at: datetime
    # Enriched join field
    agent_name: Optional[str] = None

    class Config:
        from_attributes = True
