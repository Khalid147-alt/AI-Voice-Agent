from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, Text, Integer, Float, DateTime

from database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    vapi_assistant_id = Column(String, unique=True, nullable=True)
    name = Column(String, nullable=False)
    description = Column(String, default="")
    system_prompt = Column(Text, default="")
    first_message = Column(String, default="")
    voice_id = Column(String, default="21m00Tcm4TlvDq8ikWAM")
    voice_provider = Column(String, default="11labs")
    voice_name = Column(String, default="Rachel")
    temperature = Column(Float, default=0.5)
    status = Column(String, default="active")  # active | paused
    calls_count = Column(Integer, default=0)
    success_rate = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
