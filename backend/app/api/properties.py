from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.kratos import get_kratos_session
from app.core.storage import upload_file, get_presigned_url, ensure_buckets
from app.core.config import settings
from app.models.landlord import Landlord
from app.models.property import Property, Room, PropertyPhoto
from pydantic import BaseModel
from datetime import date, datetime
import uuid

router = APIRouter(prefix="/properties", tags=["properties"])


class RoomCreate(BaseModel):
    room_type: str
    price_per_month: int
    nsfas_accepted: bool = False
    available_from: date | None = None
    amenities: dict = {}
    total_count: int = 1
    available_count: int = 1


class PropertyCreate(BaseModel):
    name: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    distance_to_campus_m: int | None = None
    description: str | None = None
    rooms: list[RoomCreate] = []


class RoomOut(BaseModel):
    id: uuid.UUID
    room_type: str
    price_per_month: int
    nsfas_accepted: bool
    is_available: bool
    available_from: date | None
    amenities: dict
    total_count: int
    available_count: int

    class Config:
        from_attributes = True


class PropertyOut(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    latitude: float | None
    longitude: float | None
    distance_to_campus_m: int | None
    description: str | None
    is_active: bool
    is_su_accredited: bool
    rooms: list[RoomOut] = []
    cover_photo_url: str | None = None

    class Config:
        from_attributes = True


async def _get_landlord(request: Request, db: AsyncSession) -> Landlord:
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])
    result = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=403, detail="Landlord profile required")
    return landlord


@router.post("/", response_model=PropertyOut)
async def create_property(
    data: PropertyCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    landlord = await _get_landlord(request, db)
    prop = Property(landlord_id=landlord.id, **{k: v for k, v in data.model_dump().items() if k != "rooms"})
    db.add(prop)
    await db.flush()

    for room_data in data.rooms:
        room = Room(property_id=prop.id, **room_data.model_dump())
        db.add(room)

    await db.commit()
    await db.refresh(prop)

    result = await db.execute(
        select(Property).options(selectinload(Property.rooms), selectinload(Property.photos))
        .where(Property.id == prop.id)
    )
    return _build_property_out(result.scalar_one())


@router.get("/", response_model=list[PropertyOut])
async def list_properties(
    min_price: int | None = Query(None),
    max_price: int | None = Query(None),
    room_type: str | None = Query(None),
    nsfas_only: bool = Query(False),
    max_distance_m: int | None = Query(None),
    su_accredited_only: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    filters = [Property.is_active == True]
    if su_accredited_only:
        filters.append(Property.is_su_accredited == True)
    if max_distance_m:
        filters.append(Property.distance_to_campus_m <= max_distance_m)

    result = await db.execute(
        select(Property)
        .options(selectinload(Property.rooms), selectinload(Property.photos))
        .where(and_(*filters))
    )
    properties = result.scalars().all()

    out = []
    for prop in properties:
        rooms = prop.rooms
        if min_price:
            rooms = [r for r in rooms if r.price_per_month >= min_price]
        if max_price:
            rooms = [r for r in rooms if r.price_per_month <= max_price]
        if room_type:
            rooms = [r for r in rooms if r.room_type == room_type]
        if nsfas_only:
            rooms = [r for r in rooms if r.nsfas_accepted]
        if rooms:
            prop.rooms = rooms
            out.append(_build_property_out(prop))

    return out


@router.get("/{property_id}", response_model=PropertyOut)
async def get_property(property_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.rooms), selectinload(Property.photos))
        .where(Property.id == property_id)
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    return _build_property_out(prop)


@router.patch("/{property_id}/rooms/{room_id}/toggle")
async def toggle_room_availability(
    property_id: uuid.UUID,
    room_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    landlord = await _get_landlord(request, db)

    result = await db.execute(
        select(Room).join(Property).where(
            Room.id == room_id,
            Property.id == property_id,
            Property.landlord_id == landlord.id,
        )
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")

    room.is_available = not room.is_available
    room.last_toggled_at = datetime.utcnow()
    await db.commit()
    return {"id": room_id, "is_available": room.is_available}


@router.post("/{property_id}/photos")
async def upload_photo(
    property_id: uuid.UUID,
    request: Request,
    file: UploadFile = File(...),
    is_cover: bool = False,
    db: AsyncSession = Depends(get_db),
):
    landlord = await _get_landlord(request, db)

    result = await db.execute(
        select(Property).where(Property.id == property_id, Property.landlord_id == landlord.id)
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    if file.content_type not in ["image/jpeg", "image/png", "image/webp"]:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP allowed")

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    ensure_buckets()
    ext = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}.get(file.content_type, ".jpg")
    key = f"{property_id}/{uuid.uuid4()}{ext}"
    upload_file(settings.minio_bucket_photos, key, data, file.content_type)

    photo = PropertyPhoto(property_id=property_id, storage_key=key, is_cover=is_cover)
    db.add(photo)
    await db.commit()
    return {"key": key}


def _build_property_out(prop: Property) -> dict:
    cover = next((p for p in prop.photos if p.is_cover), None)
    cover_url = get_presigned_url(settings.minio_bucket_photos, cover.storage_key) if cover else None
    return PropertyOut(
        id=prop.id,
        name=prop.name,
        address=prop.address,
        latitude=float(prop.latitude) if prop.latitude else None,
        longitude=float(prop.longitude) if prop.longitude else None,
        distance_to_campus_m=prop.distance_to_campus_m,
        description=prop.description,
        is_active=prop.is_active,
        is_su_accredited=prop.is_su_accredited,
        rooms=prop.rooms,
        cover_photo_url=cover_url,
    )
