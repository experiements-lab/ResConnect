from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.auth import get_current_user as get_kratos_session
from app.core.storage import upload_file, ensure_buckets, get_presigned_url, delete_file
from app.core.config import settings
from app.models.student import Student
from pydantic import BaseModel
import uuid

router = APIRouter(prefix="/students", tags=["students"])


class StudentCreate(BaseModel):
    student_number: str
    full_name: str
    sun_email: str
    year_of_study: int | None = None
    faculty: str | None = None
    nsfas_eligible: bool = False


class StudentOut(BaseModel):
    id: uuid.UUID
    student_number: str
    full_name: str
    sun_email: str
    year_of_study: int | None
    faculty: str | None
    nsfas_eligible: bool
    verification_status: str
    reject_reason: str | None
    registration_doc_key: str | None

    class Config:
        from_attributes = True


class StudentUpdate(BaseModel):
    full_name: str | None = None
    year_of_study: int | None = None
    faculty: str | None = None
    nsfas_eligible: bool | None = None


@router.post("/me", response_model=StudentOut)
async def create_student_profile(
    data: StudentCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    existing = await db.execute(select(Student).where(Student.identity_id == identity_id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Profile already exists")

    student = Student(identity_id=identity_id, **data.model_dump())
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.get("/me", response_model=StudentOut)
async def get_my_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")
    return student


@router.patch("/me", response_model=StudentOut)
async def update_my_profile(
    data: StudentUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    await db.commit()
    await db.refresh(student)
    return student


@router.post("/me/sync", response_model=StudentOut)
async def sync_student_profile(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Upsert student profile from Kratos identity traits. Call after login/registration."""
    session = await get_kratos_session(request)
    if session["identity"]["traits"].get("role") != "student":
        raise HTTPException(status_code=403, detail="Students only")
    identity_id = uuid.UUID(session["identity"]["id"])
    traits = session["identity"]["traits"]

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if student:
        return student

    email = traits.get("email", "")
    if not email.endswith("@sun.ac.za"):
        raise HTTPException(status_code=400, detail="Students must use an @sun.ac.za email address")

    student = Student(
        identity_id=identity_id,
        student_number=traits.get("student_number", ""),
        full_name=traits.get("full_name", ""),
        sun_email=email,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.post("/me/upload-registration")
async def upload_registration_doc(
    request: Request,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Profile not found")

    if file.content_type not in ["application/pdf", "image/jpeg", "image/png"]:
        raise HTTPException(status_code=400, detail="Only PDF, JPEG, or PNG allowed")

    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    ensure_buckets()
    key = f"{student.id}/{uuid.uuid4()}-registration{_ext(file.content_type)}"
    upload_file(settings.supabase_bucket_docs, key, data, file.content_type)

    student.registration_doc_key = key
    student.verification_status = "pending"
    await db.commit()

    return {"message": "Document uploaded. Verification pending.", "key": key}


@router.get("/me/registration-doc")
async def get_registration_doc_url(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student or not student.registration_doc_key:
        raise HTTPException(status_code=404, detail="No document uploaded")

    return {"url": get_presigned_url(settings.supabase_bucket_docs, student.registration_doc_key)}


@router.delete("/me/registration-doc")
async def delete_registration_doc(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    session = await get_kratos_session(request)
    identity_id = uuid.UUID(session["identity"]["id"])

    result = await db.execute(select(Student).where(Student.identity_id == identity_id))
    student = result.scalar_one_or_none()
    if not student or not student.registration_doc_key:
        raise HTTPException(status_code=404, detail="No document uploaded")

    delete_file(settings.supabase_bucket_docs, student.registration_doc_key)
    student.registration_doc_key = None
    await db.commit()

    return {"message": "Registration document deleted."}


def _ext(content_type: str) -> str:
    return {
        "application/pdf": ".pdf",
        "image/jpeg": ".jpg",
        "image/png": ".png",
    }.get(content_type, "")
