from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.core.config import settings
from app.core.storage import get_presigned_url, StorageError
from app.models.student import Student
from app.models.landlord import Landlord
from app.models.property import Property, Room
from app.models.enquiry import Enquiry
from app.models.audit_log import AuditLog
from app.api.notifications import create_notification
from pydantic import BaseModel, Field as PydanticField
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(x_admin_key: str = Header(...)):
    if x_admin_key != settings.secret_key:
        raise HTTPException(status_code=403, detail="Invalid admin key")


async def _log_action(db: AsyncSession, action: str, entity_type: str, entity_id: uuid.UUID, details: dict | None = None):
    db.add(AuditLog(actor="admin", action=action, entity_type=entity_type, entity_id=entity_id, details=details or {}))


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


@router.get("/students")
async def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    stmt = select(Student)
    count_stmt = select(func.count()).select_from(Student)
    if q:
        like = f"%{q}%"
        cond = or_(Student.full_name.ilike(like), Student.sun_email.ilike(like), Student.student_number.ilike(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if status:
        stmt = stmt.where(Student.verification_status == status)
        count_stmt = count_stmt.where(Student.verification_status == status)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Student.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = [StudentAdminOut.model_validate(s) for s in result.scalars().all()]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/landlords")
async def list_landlords(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    stmt = select(Landlord)
    count_stmt = select(func.count()).select_from(Landlord)
    if q:
        like = f"%{q}%"
        cond = or_(Landlord.full_name.ilike(like), Landlord.email.ilike(like))
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)
    if status:
        stmt = stmt.where(Landlord.verification_status == status)
        count_stmt = count_stmt.where(Landlord.verification_status == status)

    total = (await db.execute(count_stmt)).scalar_one()
    stmt = stmt.order_by(Landlord.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = [LandlordAdminOut.model_validate(l) for l in result.scalars().all()]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/stats")
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    async def count(stmt):
        return (await db.execute(stmt)).scalar_one()

    students_total = await count(select(func.count()).select_from(Student))
    students_pending = await count(select(func.count()).select_from(Student).where(Student.verification_status == "pending"))
    students_verified = await count(select(func.count()).select_from(Student).where(Student.verification_status == "verified"))
    students_rejected = await count(select(func.count()).select_from(Student).where(Student.verification_status == "rejected"))

    landlords_total = await count(select(func.count()).select_from(Landlord))
    landlords_pending = await count(select(func.count()).select_from(Landlord).where(Landlord.verification_status == "pending"))
    landlords_verified = await count(select(func.count()).select_from(Landlord).where(Landlord.verification_status == "verified"))
    landlords_rejected = await count(select(func.count()).select_from(Landlord).where(Landlord.verification_status == "rejected"))

    properties_total = await count(select(func.count()).select_from(Property))
    properties_active = await count(select(func.count()).select_from(Property).where(Property.is_active.is_(True)))
    rooms_total = await count(select(func.count()).select_from(Room))
    rooms_available = await count(select(func.count()).select_from(Room).where(Room.is_available.is_(True)))
    enquiries_total = await count(select(func.count()).select_from(Enquiry))

    return {
        "students": {"total": students_total, "pending": students_pending, "verified": students_verified, "rejected": students_rejected},
        "landlords": {"total": landlords_total, "pending": landlords_pending, "verified": landlords_verified, "rejected": landlords_rejected},
        "properties": {"total": properties_total, "active": properties_active},
        "rooms": {"total": rooms_total, "available": rooms_available},
        "enquiries": {"total": enquiries_total},
    }


@router.get("/audit-log")
async def list_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(_require_admin),
):
    total = (await db.execute(select(func.count()).select_from(AuditLog))).scalar_one()
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    items = [
        {
            "id": e.id,
            "actor": e.actor,
            "action": e.action,
            "entity_type": e.entity_type,
            "entity_id": e.entity_id,
            "details": e.details,
            "created_at": e.created_at,
        }
        for e in result.scalars().all()
    ]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


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
    try:
        url = get_presigned_url(settings.supabase_bucket_docs, student.registration_doc_key)
    except StorageError:
        logger.exception("Failed to generate registration doc URL for student %s", student_id)
        raise HTTPException(status_code=502, detail="Could not generate document link. Please try again.")
    return {"url": url}


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
    try:
        url = get_presigned_url(settings.supabase_bucket_docs, landlord.ownership_doc_key)
    except StorageError:
        logger.exception("Failed to generate ownership doc URL for landlord %s", landlord_id)
        raise HTTPException(status_code=502, detail="Could not generate document link. Please try again.")
    return {"url": url}


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
    await _log_action(db, "verify", "student", student.id, {"full_name": student.full_name})
    await db.commit()

    try:
        await create_notification(
            db, student.identity_id, "account_verified",
            "Account verified",
            "Your student account has been verified. You can now send enquiries.",
            "/student/dashboard",
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for verified student %s", student_id)
        await db.rollback()

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
    await _log_action(db, "reject", "student", student.id, {"full_name": student.full_name, "reason": body.reason})
    await db.commit()

    try:
        await create_notification(
            db, student.identity_id, "account_rejected",
            "Account verification rejected",
            f"Your student account verification was rejected: {body.reason}",
            "/student/dashboard",
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for rejected student %s", student_id)
        await db.rollback()

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
    await _log_action(db, "verify", "landlord", landlord.id, {"full_name": landlord.full_name})
    await db.commit()

    try:
        await create_notification(
            db, landlord.identity_id, "account_verified",
            "Account verified",
            "Your landlord account has been verified. Your listings are now visible to students.",
            "/landlord/dashboard",
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for verified landlord %s", landlord_id)
        await db.rollback()

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
    await _log_action(db, "reject", "landlord", landlord.id, {"full_name": landlord.full_name, "reason": body.reason})
    await db.commit()

    try:
        await create_notification(
            db, landlord.identity_id, "account_rejected",
            "Account verification rejected",
            f"Your landlord account verification was rejected: {body.reason}",
            "/landlord/dashboard",
        )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for rejected landlord %s", landlord_id)
        await db.rollback()

    return {"id": landlord_id, "verification_status": "rejected"}
