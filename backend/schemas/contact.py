from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel


class ContactBase(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = "new"
    tags: Optional[List[str]] = []
    notes: Optional[str] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    company: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None


class ContactOut(ContactBase):
    id: str
    last_called_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ContactImport(BaseModel):
    contacts: List[ContactCreate]
