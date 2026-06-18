from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update, func
from pydantic import BaseModel
from datetime import datetime
import uuid

from app.core.database import get_db
from app.core.auth import get_current_user as get_kratos_session
from app.models.notification import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationOut(BaseModel):
    id: uuid.UUID
    type: str
    title: str
    body: str | None
    link: str | None
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


async def create_notification(
    db: AsyncSession,
    identity_id: uuid.UUID,
    type: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    """Stage a notification insert. Caller is responsible for committing."""
    db.add(Notification(identity_id=identity_id, type=type, title=title, body=body, link=link))


@router.get("/me", response_model=list[NotificationOut])
async def my_notifications(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])
    result = await db.execute(
        select(Notification)
        .where(Notification.identity_id == identity_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()


@router.get("/me/unread-count")
async def unread_count(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])
    result = await db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.identity_id == identity_id, Notification.is_read == False)
    )
    return {"count": result.scalar_one()}


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.identity_id == identity_id)
    )
    notification = result.scalar_one_or_none()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    notification.is_read = True
    await db.commit()
    return {"id": notification_id, "is_read": True}


@router.post("/me/read-all")
async def mark_all_read(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])
    await db.execute(
        sql_update(Notification)
        .where(Notification.identity_id == identity_id, Notification.is_read == False)
        .values(is_read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}
