from sqlalchemy import String, Boolean, Integer, SmallInteger, Text, DateTime, ForeignKey, Date, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
from datetime import datetime, date
import uuid


class Property(Base):
    __tablename__ = "properties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    landlord_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("landlords.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Numeric(10, 8))
    longitude: Mapped[float | None] = mapped_column(Numeric(11, 8))
    distance_to_campus_m: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_su_accredited: Mapped[bool] = mapped_column(Boolean, default=False)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    rooms: Mapped[list["Room"]] = relationship("Room", back_populates="property", cascade="all, delete-orphan")
    photos: Mapped[list["PropertyPhoto"]] = relationship("PropertyPhoto", back_populates="property", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    room_type: Mapped[str] = mapped_column(String(20), nullable=False)
    price_per_month: Mapped[int] = mapped_column(Integer, nullable=False)
    nsfas_accepted: Mapped[bool] = mapped_column(Boolean, default=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)
    available_from: Mapped[date | None] = mapped_column(Date)
    amenities: Mapped[dict] = mapped_column(JSONB, default=dict)
    total_count: Mapped[int] = mapped_column(SmallInteger, default=1)
    available_count: Mapped[int] = mapped_column(SmallInteger, default=1)
    last_toggled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    property: Mapped["Property"] = relationship("Property", back_populates="rooms")


class PropertyPhoto(Base):
    __tablename__ = "property_photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    property_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("properties.id", ondelete="CASCADE"))
    storage_key: Mapped[str] = mapped_column(String(500), nullable=False)
    is_cover: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    property: Mapped["Property"] = relationship("Property", back_populates="photos")
