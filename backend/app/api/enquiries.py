from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.kratos import get_kratos_session
from app.models.student import Student
from app.models.enquiry import Enquiry
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/enquiries", tags=["enquiries"])


class EnquiryCreate(BaseModel):
    room_id: uuid.UUID
    message: str


class EnquiryOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    message: str
    status: str

    class Config:
        from_attributes = True


@router.post("/", response_model=EnquiryOut)
async def send_enquiry(
    data: EnquiryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")
    if student.verification_status != "verified":
        raise HTTPException(status_code=403, detail="Account must be verified to send enquiries")

    enquiry = Enquiry(student_id=student.id, room_id=data.room_id, message=data.message)
    db.add(enquiry)
    await db.commit()
    await db.refresh(enquiry)
    return enquiry


@router.get("/me", response_model=list[EnquiryOut])
async def my_enquiries(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")

    eq_result = await db.execute(select(Enquiry).where(Enquiry.student_id == student.id))
    return eq_result.scalars().all()
