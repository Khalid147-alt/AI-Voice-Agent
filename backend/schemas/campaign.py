from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class CampaignCreate(BaseModel):
    name: str
    agent_id: str
    contact_ids: List[str] = []
    calls_per_batch: Optional[int] = 5
    delay_between_calls_seconds: Optional[int] = 30
    scheduled_at: Optional[datetime] = None
    run_now: Optional[bool] = False


class CampaignUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    calls_per_batch: Optional[int] = None
    delay_between_calls_seconds: Optional[int] = None
    scheduled_at: Optional[datetime] = None


class CampaignOut(BaseModel):
    id: str
    name: str
    agent_id: Optional[str] = None
    status: str = "draft"
    contact_ids: List[str] = []
    calls_per_batch: int = 5
    delay_between_calls_seconds: int = 30
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    total_contacts: int = 0
    calls_made: int = 0
    calls_answered: int = 0
    leads_qualified: int = 0
    created_at: datetime
    agent_name: Optional[str] = None

    class Config:
        from_attributes = True
