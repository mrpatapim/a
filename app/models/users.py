from sqlalchemy import Column, Integer, String, Boolean, Float
from sqlalchemy.orm import relationship
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    street = Column(String, nullable=True)
    house = Column(String, nullable=True)
    apartment = Column(String, nullable=True)
    floor = Column(String, nullable=True)
    monthly_budget = Column(Float, default=0.0)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)

    meters = relationship(
        "Meter",
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
