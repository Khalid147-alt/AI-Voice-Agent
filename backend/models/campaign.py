from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, JSON

from database import Base


class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, default="")
    agent_id = Column(String, ForeignKey("agents.id"), nullable=True)
    # draft | scheduled | running | paused | completed
    status = Column(String, default="draft")
    contact_ids = Column(JSON, default=list)
    calls_per_batch = Column(Integer, default=5)
    delay_between_calls_seconds = Column(Integer, default=30)
    scheduled_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    total_contacts = Column(Integer, default=0)
    calls_made = Column(Integer, default=0)
    calls_answered = Column(Integer, default=0)
    leads_qualified = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
