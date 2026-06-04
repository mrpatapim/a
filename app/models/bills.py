from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class ServiceType(Base):
    __tablename__ = "service_types"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    unit = Column(String, nullable=False)

    meters = relationship("Meter", back_populates="service_type")


class Meter(Base):
    __tablename__ = "meters"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    service_type_id = Column(Integer, ForeignKey("service_types.id"), nullable=False)
    serial_number = Column(String, unique=True, nullable=False)
    current_tariff = Column(Float, nullable=False)

    user = relationship("User", back_populates="meters")
    service_type = relationship("ServiceType", back_populates="meters")
    readings = relationship(
        "MeterReading",
        back_populates="meter",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MeterReading(Base):
    __tablename__ = "meter_readings"

    id = Column(Integer, primary_key=True, index=True)
    meter_id = Column(Integer, ForeignKey("meters.id", ondelete="CASCADE"), nullable=False)
    reading_value = Column(Float, nullable=False)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    consumed_volume = Column(Float, nullable=True)
    calculated_cost = Column(Float, nullable=True)

    meter = relationship("Meter", back_populates="readings")
