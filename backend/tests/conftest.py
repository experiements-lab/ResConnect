# Tests run against a real Postgres database, not SQLite — models use
# Postgres-only column types (UUID, JSONB), which SQLite can't create.
# Point DATABASE_URL at a throwaway Postgres database before running pytest,
# e.g.: postgresql+asyncpg://resconnect:resconnect_secret@localhost:5432/resconnect_test
import os
import uuid

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://resconnect:resconnect_secret@localhost:5432/resconnect_test")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_JWT_SECRET", "test-jwt-secret")
os.environ.setdefault("SECRET_KEY", "test-admin-key")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:5173")

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings
from app.models.student import Student
from app.models.landlord import Landlord
from app.models.property import Property, Room


@pytest_asyncio.fixture
async def db_session():
    """Fresh schema per test: simplest correct isolation at our test-suite scale."""
    engine = create_async_engine(os.environ["DATABASE_URL"])
    session_local = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with session_local() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def client(db_session):
    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


def _fake_session(identity_id: uuid.UUID, role: str) -> dict:
    return {
        "identity": {
            "id": str(identity_id),
            "traits": {"role": role, "email": "test@example.com", "full_name": "Test User"},
        }
    }


ALL_AUTH_MODULES = (
    "app.api.enquiries",
    "app.api.notifications",
    "app.api.properties",
    "app.api.students",
    "app.api.landlords",
)


@pytest.fixture
def auth_as(monkeypatch):
    """Bypass real Supabase JWT verification: get_current_user is called directly
    in route bodies (not via Depends), so each importing module needs patching."""
    def _auth_as(identity_id: uuid.UUID, role: str, modules=ALL_AUTH_MODULES):
        async def _fake(request):
            return _fake_session(identity_id, role)
        for mod in modules:
            monkeypatch.setattr(f"{mod}.get_kratos_session", _fake)
    return _auth_as


@pytest.fixture
def admin_headers():
    return {"X-Admin-Key": settings.secret_key}


@pytest.fixture
def mock_storage(monkeypatch):
    """Storage functions are plain module-level functions imported directly into
    route modules (not Depends-injected), so patch them per-module like get_kratos_session."""
    def _mock(modules, presigned_url="https://example.com/signed-url"):
        for mod in modules:
            monkeypatch.setattr(f"{mod}.upload_file", lambda *a, **k: None)
            monkeypatch.setattr(f"{mod}.get_presigned_url", lambda *a, **k: presigned_url)
            monkeypatch.setattr(f"{mod}.delete_file", lambda *a, **k: None)
            monkeypatch.setattr(f"{mod}.ensure_buckets", lambda: None)
    return _mock


@pytest_asyncio.fixture
async def make_student(db_session):
    async def _make(verification_status="verified"):
        student = Student(
            identity_id=uuid.uuid4(),
            student_number=str(uuid.uuid4().int % 100_000_000).zfill(8),
            full_name="Test Student",
            sun_email=f"{uuid.uuid4().hex[:10]}@sun.ac.za",
            verification_status=verification_status,
        )
        db_session.add(student)
        await db_session.commit()
        await db_session.refresh(student)
        return student
    return _make


@pytest_asyncio.fixture
async def make_landlord(db_session):
    async def _make(verification_status="verified"):
        landlord = Landlord(
            identity_id=uuid.uuid4(),
            full_name="Test Landlord",
            email=f"{uuid.uuid4().hex[:10]}@example.com",
            verification_status=verification_status,
        )
        db_session.add(landlord)
        await db_session.commit()
        await db_session.refresh(landlord)
        return landlord
    return _make


@pytest_asyncio.fixture
async def make_room(db_session):
    async def _make(
        landlord,
        price=3500,
        available_count=1,
        room_type="single",
        nsfas_accepted=False,
        amenities=None,
        is_active=True,
    ):
        prop = Property(
            landlord_id=landlord.id,
            name="Test Property",
            address="1 Test St, Stellenbosch",
            is_active=is_active,
        )
        db_session.add(prop)
        await db_session.flush()
        room = Room(
            property_id=prop.id,
            room_type=room_type,
            price_per_month=price,
            total_count=available_count,
            available_count=available_count,
            nsfas_accepted=nsfas_accepted,
            amenities=amenities or {},
        )
        db_session.add(room)
        await db_session.commit()
        await db_session.refresh(room)
        await db_session.refresh(prop)
        return room, prop
    return _make
