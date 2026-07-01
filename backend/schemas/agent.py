from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class AgentBase(BaseModel):
    name: str
    description: Optional[str] = ""
    system_prompt: Optional[str] = ""
    first_message: Optional[str] = ""
    voice_id: Optional[str] = "21m00Tcm4TlvDq8ikWAM"
    voice_provider: Optional[str] = "11labs"
    voice_name: Optional[str] = "Rachel"
    temperature: Optional[float] = 0.5
    status: Optional[str] = "active"


class AgentCreate(AgentBase):
    pass


class AgentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    first_message: Optional[str] = None
    voice_id: Optional[str] = None
    voice_provider: Optional[str] = None
    voice_name: Optional[str] = None
    temperature: Optional[float] = None
    status: Optional[str] = None


class AgentOut(AgentBase):
    id: str
    vapi_assistant_id: Optional[str] = None
    calls_count: int = 0
    success_rate: float = 0.0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
