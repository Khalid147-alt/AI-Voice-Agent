from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
)

from database import Base


class Call(Base):
    __tablename__ = "calls"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    vapi_call_id = Column(String, unique=True, nullable=True)
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True)
    campaign_id = Column(String, ForeignKey("campaigns.id"), nullable=True)
    direction = Column(String, default="outbound")  # inbound | outbound
    # queued | ringing | in-progress | completed | failed | no-answer
    status = Column(String, default="queued")
    phone_number = Column(String, default="")
    duration_seconds = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)
    transcript = Column(JSON, nullable=True)  # list of {role, content, timestamp}
    summary = Column(Text, nullable=True)
    analysis = Column(JSON, nullable=True)  # structured VAPI / LangGraph analysis
    recording_url = Column(String, nullable=True)
    interest_level = Column(String, nullable=True)  # hot | warm | cold
    success = Column(Boolean, nullable=True)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
