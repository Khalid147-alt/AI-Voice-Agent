from datetime import datetime
from uuid import uuid4

from sqlalchemy import Column, String, Text, DateTime, JSON

from database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id = Column(String, primary_key=True, default=lambda: str(uuid4()))
    name = Column(String, default="")
    phone = Column(String, default="")
    email = Column(String, nullable=True)
    company = Column(String, nullable=True)
    # new | contacted | qualified | booked | rejected
    status = Column(String, default="new")
    tags = Column(JSON, default=list)
    notes = Column(Text, nullable=True)
    last_called_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
