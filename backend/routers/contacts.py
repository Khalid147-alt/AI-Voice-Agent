from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.contact import Contact
from schemas.contact import ContactCreate, ContactUpdate, ContactOut, ContactImport
from utils import envelope

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


@router.get("")
async def list_contacts(status: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(Contact).order_by(Contact.created_at.desc())
    if status:
        query = query.where(Contact.status == status)
    rows = (await db.execute(query)).scalars().all()
    return envelope([ContactOut.model_validate(c).model_dump(mode="json") for c in rows])


@router.post("")
async def create_contact(payload: ContactCreate, db: AsyncSession = Depends(get_db)):
    contact = Contact(**payload.model_dump())
    db.add(contact)
    await db.commit()
    return envelope(ContactOut.model_validate(contact).model_dump(mode="json"))


@router.post("/import")
async def import_contacts(payload: ContactImport, db: AsyncSession = Depends(get_db)):
    created = []
    for c in payload.contacts:
        contact = Contact(**c.model_dump())
        db.add(contact)
        created.append(contact)
    await db.commit()
    return envelope({"imported": len(created)})


@router.patch("/{contact_id}")
async def update_contact(contact_id: str, payload: ContactUpdate, db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(select(Contact).where(Contact.id == contact_id))).scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)
    await db.commit()
    return envelope(ContactOut.model_validate(contact).model_dump(mode="json"))


@router.delete("/{contact_id}")
async def delete_contact(contact_id: str, db: AsyncSession = Depends(get_db)):
    contact = (await db.execute(select(Contact).where(Contact.id == contact_id))).scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()
    return envelope({"deleted": contact_id})
