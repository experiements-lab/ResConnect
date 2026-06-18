from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.core.storage import get_presigned_url
from app.models.student import Student
from app.models.landlord import Landlord
from app.api.notifications import create_notification
from pydantic import BaseModel, Field as PydanticField
import uuid

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.secret_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")


class RejectBody(BaseModel):
    reason: str = PydanticField(..., min_length=1, max_length=500)


class StudentAdminOut(BaseModel):
    id: uuid.UUID
    student_number: str
    full_name: str
    sun_email: str
    verification_status: str
    reject_reason: str | None
    registration_doc_key: str | None

    class Config:
        from_attributes = True


class LandlordAdminOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    verification_status: str
    reject_reason: str | None
    ownership_doc_key: str | None
    is_su_accredited: bool

    class Config:
        from_attributes = True


@router.get("/students", response_model=list[StudentAdminOut])
async def list_students(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Student).order_by(Student.created_at.desc()))
    return result.scalars().all()


@router.get("/landlords", response_model=list[LandlordAdminOut])
async def list_landlords(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Landlord).order_by(Landlord.created_at.desc()))
    return result.scalars().all()


@router.get("/students/{student_id}/doc")
async def student_doc_url(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student or not student.registration_doc_key:
        raise HTTPException(status_code=404, detail="No document uploaded")
    return {"url": get_presigned_url(settings.supabase_bucket_docs, student.registration_doc_key)}


@router.get("/landlords/{landlord_id}/doc")
async def landlord_doc_url(
    landlord_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord or not landlord.ownership_doc_key:
        raise HTTPException(status_code=404, detail="No document uploaded")
    return {"url": get_presigned_url(settings.supabase_bucket_docs, landlord.ownership_doc_key)}


@router.post("/students/{student_id}/verify")
async def verify_student(
    student_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.verification_status = "verified"
    await create_notification(
        db, student.identity_id, "account_verified",
        "Account verified",
        "Your student account has been verified. You can now send enquiries.",
        "/student/dashboard",
    )
    await db.commit()
    return {"id": student_id, "verification_status": "verified"}


@router.post("/students/{student_id}/reject")
async def reject_student(
    student_id: uuid.UUID,
    body: RejectBody,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Student).where(Student.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    student.verification_status = "rejected"
    student.reject_reason = body.reason
    await create_notification(
        db, student.identity_id, "account_rejected",
        "Account verification rejected",
        f"Your student account verification was rejected: {body.reason}",
        "/student/dashboard",
    )
    await db.commit()
    return {"id": student_id, "verification_status": "rejected"}


@router.post("/landlords/{landlord_id}/verify")
async def verify_landlord(
    landlord_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    landlord.verification_status = "verified"
    await create_notification(
        db, landlord.identity_id, "account_verified",
        "Account verified",
        "Your landlord account has been verified. Your listings are now visible to students.",
        "/landlord/dashboard",
    )
    await db.commit()
    return {"id": landlord_id, "verification_status": "verified"}


@router.post("/landlords/{landlord_id}/reject")
async def reject_landlord(
    landlord_id: uuid.UUID,
    body: RejectBody,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    result = await db.execute(select(Landlord).where(Landlord.id == landlord_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=404, detail="Landlord not found")
    landlord.verification_status = "rejected"
    landlord.reject_reason = body.reason
    await create_notification(
        db, landlord.identity_id, "account_rejected",
        "Account verification rejected",
        f"Your landlord account verification was rejected: {body.reason}",
        "/landlord/dashboard",
    )
    await db.commit()
    return {"id": landlord_id, "verification_status": "rejected"}
