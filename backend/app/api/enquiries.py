from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import Field as PydanticField

from app.core.database import get_db
from app.core.auth import get_current_user as get_kratos_session
from app.models.student import Student
from app.models.landlord import Landlord
from app.models.enquiry import Enquiry, EnquiryMessage
from sqlalchemy.orm import selectinload
from app.models.property import Room, Property
from app.api.notifications import create_notification
from pydantic import BaseModel
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/enquiries", tags=["enquiries"])

VALID_STATUS_TRANSITIONS: dict[str, list[str]] = {
    "sent": ["read", "responded"],
    "read": ["responded"],
    "responded": [],
    "closed": [],
}


class EnquiryCreate(BaseModel):
    room_id: uuid.UUID
    message: str = PydanticField(..., min_length=1, max_length=2000)


class EnquiryRespond(BaseModel):
    response: str = PydanticField(..., min_length=1, max_length=2000)


class EnquiryOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    message: str
    status: str
    booking_status: str = "enquiring"
    reject_reason: str | None = None
    landlord_response: str | None = None
    responded_at: datetime | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class EnquiryStudentOut(EnquiryOut):
    property_name: str | None = None
    property_id: uuid.UUID | None = None
    room_type: str | None = None
    price_per_month: int | None = None


class EnquiryWithContext(EnquiryOut):
    student_name: str | None = None
    student_email: str | None = None
    property_name: str | None = None
    room_type: str | None = None
    price_per_month: int | None = None


@router.post("/", response_model=EnquiryOut)
async def send_enquiry(
    data: EnquiryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    role = session["identity"]["traits"].get("role")
    if role != "student":
        raise HTTPException(status_code=403, detail="Students only")

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")
    if student.verification_status != "verified":
        raise HTTPException(status_code=403, detail="Account must be verified to send enquiries")

    room_result = await db.execute(select(Room).where(Room.id == data.room_id))
    room = room_result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if not room.is_available:
        raise HTTPException(status_code=409, detail="Room is no longer available")

    existing = await db.execute(
        select(Enquiry).where(
            Enquiry.student_id == student.id,
            Enquiry.room_id == data.room_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already enquired on this room")

    owner_result = await db.execute(
        select(Property, Landlord)
        .join(Landlord, Landlord.id == Property.landlord_id)
        .where(Property.id == room.property_id)
    )
    prop, landlord_owner = owner_result.one()

    enquiry = Enquiry(student_id=student.id, room_id=data.room_id, message=data.message)
    db.add(enquiry)
    await db.commit()
    await db.refresh(enquiry)

    try:
        async with db.begin_nested():
            await create_notification(
                db, landlord_owner.identity_id, "new_enquiry",
                "New enquiry received",
                f"{student.full_name} enquired about a room at {prop.name}",
                "/landlord/dashboard",
            )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for new enquiry %s", enquiry.id)

    return enquiry


@router.get("/me", response_model=list[EnquiryStudentOut])
async def my_enquiries(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    role = session["identity"]["traits"].get("role")
    if role != "student":
        raise HTTPException(status_code=403, detail="Students only")
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")

    eq_result = await db.execute(
        select(Enquiry, Room, Property)
        .join(Room, Enquiry.room_id == Room.id)
        .join(Property, Room.property_id == Property.id)
        .where(Enquiry.student_id == student.id)
        .order_by(Enquiry.created_at.desc())
    )
    rows = eq_result.all()

    return [
        EnquiryStudentOut(
            id=enquiry.id,
            room_id=enquiry.room_id,
            message=enquiry.message,
            status=enquiry.status,
            booking_status=enquiry.booking_status,
            reject_reason=enquiry.reject_reason,
            landlord_response=enquiry.landlord_response,
            responded_at=enquiry.responded_at,
            created_at=enquiry.created_at,
            property_name=prop.name,
            property_id=prop.id,
            room_type=room.room_type,
            price_per_month=room.price_per_month,
        )
        for enquiry, room, prop in rows
    ]


@router.get("/landlord", response_model=list[EnquiryWithContext])
async def landlord_enquiries(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    lr = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    landlord = lr.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=403, detail="Landlord profile required")

    result = await db.execute(
        select(Enquiry, Student, Room, Property)
        .join(Room, Enquiry.room_id == Room.id)
        .join(Property, Room.property_id == Property.id)
        .join(Student, Enquiry.student_id == Student.id)
        .where(Property.landlord_id == landlord.id)
        .order_by(Enquiry.created_at.desc())
    )
    rows = result.all()

    return [
        EnquiryWithContext(
            id=enquiry.id,
            room_id=enquiry.room_id,
            message=enquiry.message,
            status=enquiry.status,
            booking_status=enquiry.booking_status,
            reject_reason=enquiry.reject_reason,
            landlord_response=enquiry.landlord_response,
            responded_at=enquiry.responded_at,
            created_at=enquiry.created_at,
            student_name=student.full_name,
            student_email=student.sun_email,
            property_name=prop.name,
            room_type=room.room_type,
            price_per_month=room.price_per_month,
        )
        for enquiry, student, room, prop in rows
    ]


@router.patch("/{enquiry_id}/read")
async def mark_enquiry_read(
    enquiry_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    lr = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    landlord = lr.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=403, detail="Landlord profile required")

    result = await db.execute(
        select(Enquiry)
        .join(Room, Enquiry.room_id == Room.id)
        .join(Property, Room.property_id == Property.id)
        .where(Enquiry.id == enquiry_id, Property.landlord_id == landlord.id)
    )
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    if "read" in VALID_STATUS_TRANSITIONS.get(enquiry.status, []):
        enquiry.status = "read"
        await db.commit()

    return {"id": enquiry_id, "status": enquiry.status}


@router.post("/{enquiry_id}/respond", response_model=EnquiryOut)
async def respond_to_enquiry(
    enquiry_id: uuid.UUID,
    data: EnquiryRespond,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    lr = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    landlord = lr.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=403, detail="Landlord profile required")

    result = await db.execute(
        select(Enquiry)
        .join(Room, Enquiry.room_id == Room.id)
        .join(Property, Room.property_id == Property.id)
        .where(Enquiry.id == enquiry_id, Property.landlord_id == landlord.id)
    )
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")

    if "responded" not in VALID_STATUS_TRANSITIONS.get(enquiry.status, []):
        raise HTTPException(status_code=409, detail="This enquiry has already been responded to")

    enquiry.landlord_response = data.response
    enquiry.status = "responded"
    enquiry.responded_at = datetime.utcnow()
    await db.commit()
    await db.refresh(enquiry)

    try:
        async with db.begin_nested():
            student, prop, _ = await _enquiry_notify_context(enquiry, db)
            await create_notification(
                db, student.identity_id, "enquiry_responded",
                "Landlord responded to your enquiry",
                f"You have a new response for {prop.name}",
                "/student/dashboard",
            )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for enquiry response %s", enquiry.id)

    return enquiry


# ── Chat thread endpoints ──────────────────────────────────────────────────


class MessageCreate(BaseModel):
    body: str = PydanticField(..., min_length=1, max_length=2000)


class MessageOut(BaseModel):
    id: uuid.UUID
    enquiry_id: uuid.UUID
    sender_role: str
    body: str
    created_at: datetime

    class Config:
        from_attributes = True


async def _get_enquiry_for_student(enquiry_id: uuid.UUID, request: Request, db: AsyncSession) -> Enquiry:
    session = await get_kratos_session(request)
    sr = await db.execute(select(Student).where(Student.identity_id == uuid.UUID(session["identity"]["id"])))
    student = sr.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=403, detail="Student profile required")
    result = await db.execute(
        select(Enquiry).where(Enquiry.id == enquiry_id, Enquiry.student_id == student.id)
    )
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return enquiry


async def _get_enquiry_for_landlord(enquiry_id: uuid.UUID, request: Request, db: AsyncSession) -> Enquiry:
    session = await get_kratos_session(request)
    lr = await db.execute(select(Landlord).where(Landlord.identity_id == uuid.UUID(session["identity"]["id"])))
    landlord = lr.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=403, detail="Landlord profile required")
    result = await db.execute(
        select(Enquiry)
        .join(Room, Enquiry.room_id == Room.id)
        .join(Property, Room.property_id == Property.id)
        .where(Enquiry.id == enquiry_id, Property.landlord_id == landlord.id)
    )
    enquiry = result.scalar_one_or_none()
    if not enquiry:
        raise HTTPException(status_code=404, detail="Enquiry not found")
    return enquiry


async def _enquiry_notify_context(enquiry: Enquiry, db: AsyncSession) -> tuple[Student, Property, Landlord]:
    """Resolve the student, property, and landlord behind an enquiry for notification targeting."""
    sr = await db.execute(select(Student).where(Student.id == enquiry.student_id))
    student = sr.scalar_one()
    pr = await db.execute(
        select(Property, Landlord)
        .join(Landlord, Landlord.id == Property.landlord_id)
        .join(Room, Room.property_id == Property.id)
        .where(Room.id == enquiry.room_id)
    )
    prop, landlord = pr.one()
    return student, prop, landlord


@router.get("/{enquiry_id}/messages", response_model=list[MessageOut])
async def get_messages(
    enquiry_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Fetch all messages for an enquiry. Accessible by both the student and the landlord."""
    session = await get_kratos_session(request)
    role = session["identity"]["traits"].get("role")

    if role == "student":
        await _get_enquiry_for_student(enquiry_id, request, db)
    else:
        await _get_enquiry_for_landlord(enquiry_id, request, db)

    result = await db.execute(
        select(EnquiryMessage)
        .where(EnquiryMessage.enquiry_id == enquiry_id)
        .order_by(EnquiryMessage.created_at)
    )
    return result.scalars().all()


@router.post("/{enquiry_id}/messages", response_model=MessageOut)
async def send_message(
    enquiry_id: uuid.UUID,
    data: MessageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Send a message in an enquiry thread. Student or landlord."""
    session = await get_kratos_session(request)
    role = session["identity"]["traits"].get("role")

    if role == "student":
        enquiry = await _get_enquiry_for_student(enquiry_id, request, db)
        sender_role = "student"
        # Rejected students cannot send new messages
        identity_id = uuid.UUID(session["identity"]["id"])
        sr = await db.execute(select(Student).where(Student.identity_id == identity_id))
        student = sr.scalar_one_or_none()
        if student and student.verification_status == "rejected":
            raise HTTPException(status_code=403, detail="Your account has been rejected. You can no longer send messages.")
    elif role == "landlord":
        enquiry = await _get_enquiry_for_landlord(enquiry_id, request, db)
        sender_role = "landlord"
        if "responded" in VALID_STATUS_TRANSITIONS.get(enquiry.status, []):
            enquiry.status = "responded"
            enquiry.responded_at = datetime.utcnow()
    else:
        raise HTTPException(status_code=403, detail="Invalid role")

    msg = EnquiryMessage(enquiry_id=enquiry_id, sender_role=sender_role, body=data.body)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    try:
        async with db.begin_nested():
            student, prop, landlord_owner = await _enquiry_notify_context(enquiry, db)
            if sender_role == "student":
                await create_notification(
                    db, landlord_owner.identity_id, "new_message",
                    "New message",
                    f"{student.full_name} sent a message about {prop.name}",
                    "/landlord/dashboard",
                )
            else:
                await create_notification(
                    db, student.identity_id, "new_message",
                    "New message from landlord",
                    f"You have a new message about {prop.name}",
                    "/student/dashboard",
                )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for message on enquiry %s", enquiry_id)

    return msg


# ── Booking flow endpoints ─────────────────────────────────────────────────


class BookingRejectBody(BaseModel):
    reason: str = PydanticField(..., min_length=1, max_length=500)


VALID_BOOKING_TRANSITIONS: dict[str, list[str]] = {
    "enquiring": ["viewing_arranged", "accepted", "declined"],
    "viewing_arranged": ["accepted", "declined"],
    "accepted": ["cancelled"],
    "declined": [],
    "cancelled": [],
}


@router.post("/{enquiry_id}/accept", response_model=EnquiryOut)
async def accept_enquiry(
    enquiry_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Landlord accepts a student's enquiry — marks room as booked."""
    enquiry = await _get_enquiry_for_landlord(enquiry_id, request, db)

    if "accepted" not in VALID_BOOKING_TRANSITIONS.get(enquiry.booking_status, []):
        raise HTTPException(status_code=409, detail=f"Cannot accept from '{enquiry.booking_status}' status")

    enquiry.booking_status = "accepted"
    if enquiry.status not in ("responded",):
        enquiry.status = "responded"
        enquiry.responded_at = datetime.utcnow()

    # Decrement available_count on the room
    room_result = await db.execute(select(Room).where(Room.id == enquiry.room_id))
    room = room_result.scalar_one_or_none()
    if room and room.available_count > 0:
        room.available_count -= 1
        if room.available_count == 0:
            room.is_available = False

    await db.commit()
    await db.refresh(enquiry)

    try:
        async with db.begin_nested():
            student, prop, _ = await _enquiry_notify_context(enquiry, db)
            await create_notification(
                db, student.identity_id, "enquiry_accepted",
                "Your booking was accepted!",
                f"Your enquiry for {prop.name} has been accepted.",
                "/student/dashboard",
            )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for accepted enquiry %s", enquiry.id)

    return enquiry


@router.post("/{enquiry_id}/cancel", response_model=EnquiryOut)
async def cancel_enquiry(
    enquiry_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Landlord undoes a mistaken acceptance — restores room availability."""
    enquiry = await _get_enquiry_for_landlord(enquiry_id, request, db)

    if "cancelled" not in VALID_BOOKING_TRANSITIONS.get(enquiry.booking_status, []):
        raise HTTPException(status_code=409, detail=f"Cannot cancel from '{enquiry.booking_status}' status")

    enquiry.booking_status = "cancelled"

    room_result = await db.execute(select(Room).where(Room.id == enquiry.room_id))
    room = room_result.scalar_one_or_none()
    if room:
        room.available_count = min(room.available_count + 1, room.total_count)
        room.is_available = True

    await db.commit()
    await db.refresh(enquiry)

    try:
        async with db.begin_nested():
            student, prop, _ = await _enquiry_notify_context(enquiry, db)
            await create_notification(
                db, student.identity_id, "enquiry_cancelled",
                "Booking acceptance withdrawn",
                f"Your accepted booking for {prop.name} was withdrawn by the landlord.",
                "/student/dashboard",
            )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for cancelled enquiry %s", enquiry.id)

    return enquiry


@router.post("/{enquiry_id}/decline", response_model=EnquiryOut)
async def decline_enquiry(
    enquiry_id: uuid.UUID,
    body: BookingRejectBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Landlord declines a student's enquiry with a reason."""
    enquiry = await _get_enquiry_for_landlord(enquiry_id, request, db)

    if "declined" not in VALID_BOOKING_TRANSITIONS.get(enquiry.booking_status, []):
        raise HTTPException(status_code=409, detail=f"Cannot decline from '{enquiry.booking_status}' status")

    enquiry.booking_status = "declined"
    enquiry.reject_reason = body.reason
    if enquiry.status not in ("responded",):
        enquiry.status = "responded"
        enquiry.responded_at = datetime.utcnow()

    await db.commit()
    await db.refresh(enquiry)

    try:
        async with db.begin_nested():
            student, prop, _ = await _enquiry_notify_context(enquiry, db)
            await create_notification(
                db, student.identity_id, "enquiry_declined",
                "Your enquiry was declined",
                f"Your enquiry for {prop.name} was declined: {body.reason}",
                "/student/dashboard",
            )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for declined enquiry %s", enquiry.id)

    return enquiry


@router.post("/{enquiry_id}/arrange-viewing", response_model=EnquiryOut)
async def arrange_viewing(
    enquiry_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Landlord marks that a viewing has been arranged."""
    enquiry = await _get_enquiry_for_landlord(enquiry_id, request, db)

    if "viewing_arranged" not in VALID_BOOKING_TRANSITIONS.get(enquiry.booking_status, []):
        raise HTTPException(status_code=409, detail="Cannot arrange viewing at this stage")

    enquiry.booking_status = "viewing_arranged"
    await db.commit()
    await db.refresh(enquiry)

    try:
        async with db.begin_nested():
            student, prop, _ = await _enquiry_notify_context(enquiry, db)
            await create_notification(
                db, student.identity_id, "viewing_arranged",
                "Viewing arranged",
                f"A viewing has been arranged for {prop.name}.",
                "/student/dashboard",
            )
        await db.commit()
    except Exception:
        logger.exception("Failed to create notification for arranged viewing %s", enquiry.id)

    return enquiry
