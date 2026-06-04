from pydantic import BaseModel
from datetime import datetime

class ServiceTypeBase(BaseModel):
    name: str
    unit: str

class ServiceTypeCreate(ServiceTypeBase):
    pass

class ServiceTypeOut(ServiceTypeBase):
    id: int

    class Config:
        from_attributes = True

class MeterCreate(BaseModel):
    service_type_id: int
    serial_number: str
    current_tariff: float

class MeterOut(BaseModel):
    id: int
    user_id: int
    service_type_id: int
    serial_number: str
    current_tariff: float

    class Config:
        from_attributes = True

class MeterReadingCreate(BaseModel):
    reading_value: float
    recorded_at: datetime | None = None

class MeterReadingOut(BaseModel):
    id: int
    meter_id: int
    reading_value: float
    recorded_at: datetime
    consumed_volume: float | None
    calculated_cost: float | None

    class Config:
        from_attributes = True