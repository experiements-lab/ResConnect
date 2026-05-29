from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.kratos import get_kratos_session
from app.core.storage import upload_file, ensure_buckets
from app.core.config import settings
from app.models.landlord import Landlord
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/landlords", tags=["landlords"])


class LandlordCreate(BaseModel):
    full_name: str
    email: str
    phone: str


class LandlordOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    phone: str | None
    verification_status: str
    is_su_accredited: bool

    class Config:
        from_attributes = True


@router.post("/me", response_model=LandlordOut)
async def create_landlord_profile(
    data: LandlordCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    existing = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Profile already exists")

    landlord = Landlord(identity_id=identity_id, **data.model_dump())
    db.add(landlord)
    await db.commit()
    await db.refresh(landlord)
    return landlord


@router.get("/me", response_model=LandlordOut)
async def get_my_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=404, detail="Profile not found")
    return landlord


@router.post("/me/upload-ownership")
async def upload_ownership_doc(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Landlord).where(Landlord.identity_id == identity_id))
    landlord = result.scalar_one_or_none()
    if not landlord:
        raise HTTPException(status_code=404, detail="Profile not found")

    if file.content_type not in ["application/pdf", "image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, or PNG allowed")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    ensure_buckets()
    ext = {"application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png"}.get(file.content_type, "")
    key = f"{landlord.id}/{uuid.uuid4()}-ownership{ext}"
    upload_file(settings.minio_bucket_docs, key, data, file.content_type)

    landlord.ownership_doc_key = key
    landlord.verification_status = "pending"
    await db.commit()

    return {"message": "Ownership document uploaded. Verification pending.", "key": key}
