from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update as sql_update
from sqlalchemy.orm import selectinload
from app.core.database import get_db
from app.core.auth import get_current_user as get_kratos_session
from app.core.storage import upload_file, get_presigned_url, ensure_buckets
from app.core.config import settings
from app.models.landlord import Landlord
from app.models.property import Property, Room, PropertyPhoto
from pydantic import BaseModel, model_validator, Field as PydanticField
from datetime import date, datetime, date as date_type
import uuid

router = APIRouter(prefix="/properties", tags=["properties"])


class RoomCreate(BaseModel):
    room_type: str
    price_per_month: int = PydanticField(..., gt=0)
    nsfas_accepted: bool = False
    available_from: date | None = None
    amenities: dict = {}
    total_count: int = PydanticField(default=1, ge=1)
    available_count: int = PydanticField(default=1, ge=0)

    @model_validator(mode="after")
    def check_counts(self):
        if self.available_count > self.total_count:
            raise ValueError("available_count cannot exceed total_count")
        if self.available_from and self.available_from < date_type.today():
            raise ValueError("available_from must be today or a future date")
        return self


class PropertyCreate(BaseModel):
    name: str
    address: str
    latitude: float | None = None
    longitude: float | None = None
    distance_to_campus_m: int | None = PydanticField(default=None, gt=0)
    description: str | None = None
    is_su_accredited: bool = False
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
    if session["identity"]["traits"].get("role") != "landlord":
        raise HTTPException(status_code=403, detail="Landlords only")
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
    if not data.rooms:
        raise HTTPException(status_code=400, detail="A property must have at least one room type")
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


@router.get("/mine", response_model=list[PropertyOut])
async def list_my_properties(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    landlord = await _get_landlord(request, db)
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.rooms), selectinload(Property.photos))
        .where(Property.landlord_id == landlord.id)
    )
    return [_build_property_out(p) for p in result.scalars().all()]


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
    filters = [Property.is_active == True, Landlord.verification_status == "verified"]
    if su_accredited_only:
        filters.append(Property.is_su_accredited == True)
    if max_distance_m:
        filters.append(Property.distance_to_campus_m <= max_distance_m)

    result = await db.execute(
        select(Property)
        .join(Landlord, Property.landlord_id == Landlord.id)
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


class PropertyUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    description: str | None = None
    distance_to_campus_m: int | None = PydanticField(default=None, gt=0)
    is_su_accredited: bool | None = None
    is_active: bool | None = None


AMENITY_KEYS = {"wifi", "water_included", "electricity_included", "laundry", "parking", "security", "kitchen"}


class RoomUpdate(BaseModel):
    room_type: str | None = None
    price_per_month: int | None = PydanticField(default=None, gt=0)
    nsfas_accepted: bool | None = None
    total_count: int | None = PydanticField(default=None, ge=1)
    available_count: int | None = PydanticField(default=None, ge=0)
    amenities: dict | None = None
    available_from: date | None = None

    @model_validator(mode="after")
    def check_counts(self):
        if self.available_count is not None and self.total_count is not None:
            if self.available_count > self.total_count:
                raise ValueError("available_count cannot exceed total_count")
        if self.available_from and self.available_from < date_type.today():
            raise ValueError("available_from must be today or a future date")
        return self


@router.patch("/{property_id}", response_model=PropertyOut)
async def update_property(
    property_id: uuid.UUID,
    data: PropertyUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    landlord = await _get_landlord(request, db)
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.rooms), selectinload(Property.photos))
        .where(Property.id == property_id, Property.landlord_id == landlord.id)
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(prop, field, value)

    await db.commit()
    await db.refresh(prop)

    result = await db.execute(
        select(Property).options(selectinload(Property.rooms), selectinload(Property.photos))
        .where(Property.id == property_id)
    )
    return _build_property_out(result.scalar_one())


@router.patch("/{property_id}/rooms/{room_id}", response_model=RoomOut)
async def update_room(
    property_id: uuid.UUID,
    room_id: uuid.UUID,
    data: RoomUpdate,
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

    update_data = data.model_dump(exclude_none=True)
    if "amenities" in update_data:
        update_data["amenities"] = {k: v for k, v in update_data["amenities"].items() if k in AMENITY_KEYS}
    for field, value in update_data.items():
        setattr(room, field, value)

    await db.commit()
    await db.refresh(room)
    return room


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
    upload_file(settings.supabase_bucket_photos, key, data, file.content_type)

    if is_cover:
        await db.execute(
            sql_update(PropertyPhoto)
            .where(PropertyPhoto.property_id == property_id, PropertyPhoto.is_cover == True)
            .values(is_cover=False)
        )

    photo = PropertyPhoto(property_id=property_id, storage_key=key, is_cover=is_cover)
    db.add(photo)
    await db.commit()
    return {"key": key}


@router.delete("/{property_id}/rooms/{room_id}", status_code=204)
async def delete_room(
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
    await db.delete(room)
    await db.commit()
    return Response(status_code=204)


@router.delete("/{property_id}", status_code=204)
async def delete_property(
    property_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    landlord = await _get_landlord(request, db)
    result = await db.execute(
        select(Property)
        .options(selectinload(Property.photos))
        .where(Property.id == property_id, Property.landlord_id == landlord.id)
    )
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=404, detail="Property not found")
    for photo in prop.photos:
        from app.core.storage import delete_file
        delete_file(settings.supabase_bucket_photos, photo.storage_key)
    await db.delete(prop)
    await db.commit()
    return Response(status_code=204)


def _build_property_out(prop: Property) -> dict:
    cover = next((p for p in prop.photos if p.is_cover), None)
    cover_url = get_presigned_url(settings.supabase_bucket_photos, cover.storage_key) if cover else None
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
