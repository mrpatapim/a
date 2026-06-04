from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List
from datetime import datetime
from app.database import get_db
from app.models.bills import ServiceType, Meter, MeterReading
from app.models.users import User
from app.schemas.bills import MeterCreate, MeterOut, MeterReadingCreate, MeterReadingOut, ServiceTypeOut
from app.security import get_current_user

router = APIRouter(prefix="/bills", tags=["Bills & Meters"])

@router.get("/service-types", response_model=List[ServiceTypeOut])
def get_service_types(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(ServiceType).all()

@router.post("/meters", response_model=MeterOut, status_code=status.HTTP_201_CREATED)
def create_meter(meter: MeterCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    service_type = db.query(ServiceType).filter(ServiceType.id == meter.service_type_id).first()
    if not service_type:
        raise HTTPException(status_code=404, detail="Service type not found")
    
    db_meter = db.query(Meter).filter(Meter.serial_number == meter.serial_number).first()
    if db_meter:
        raise HTTPException(status_code=400, detail="Meter with this serial number already exists")
    
    new_meter = Meter(
        user_id=current_user.id,
        service_type_id=meter.service_type_id,
        serial_number=meter.serial_number,
        current_tariff=meter.current_tariff
    )
    db.add(new_meter)
    db.commit()
    db.refresh(new_meter)
    return new_meter

@router.get("/meters", response_model=List[MeterOut])
def get_user_meters(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Meter).filter(Meter.user_id == current_user.id).all()

@router.post("/meters/{meter_id}/readings", response_model=MeterReadingOut, status_code=status.HTTP_201_CREATED)
def add_reading(meter_id: int, reading: MeterReadingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meter = db.query(Meter).filter(Meter.id == meter_id, Meter.user_id == current_user.id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    last_reading = db.query(MeterReading).filter(MeterReading.meter_id == meter_id).order_by(MeterReading.recorded_at.desc()).first()
    
    consumed_volume = 0.0
    if last_reading:
        if reading.reading_value < last_reading.reading_value:
            raise HTTPException(status_code=400, detail="New reading cannot be less than the previous one")
        consumed_volume = reading.reading_value - last_reading.reading_value
    else:
        consumed_volume = 0.0

    calculated_cost = consumed_volume * meter.current_tariff
    reading_date = reading.recorded_at if reading.recorded_at else datetime.utcnow()

    new_reading = MeterReading(
        meter_id=meter_id,
        reading_value=reading.reading_value,
        consumed_volume=consumed_volume,
        calculated_cost=calculated_cost,
        recorded_at=reading_date
    )
    db.add(new_reading)
    db.commit()
    db.refresh(new_reading)
    return new_reading

@router.get("/meters/{meter_id}/readings")
def get_meter_readings(meter_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meter = db.query(Meter).options(joinedload(Meter.service_type)).filter(Meter.id == meter_id, Meter.user_id == current_user.id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
    
    readings = db.query(MeterReading).filter(MeterReading.meter_id == meter_id).order_by(MeterReading.recorded_at.asc()).all()
    
    result = []
    for r in readings:
        result.append({
            "id": r.id,
            "meter_id": r.meter_id,
            "reading_value": r.reading_value,
            "recorded_at": r.recorded_at,
            "consumed_volume": r.consumed_volume,
            "calculated_cost": r.calculated_cost,
            "service_name": meter.service_type.name,
            "serial_number": meter.serial_number,
            "unit": meter.service_type.unit
        })
    return result

@router.delete("/readings/{reading_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_reading(reading_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reading = db.query(MeterReading).join(Meter).filter(MeterReading.id == reading_id, Meter.user_id == current_user.id).first()
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found or unauthorized")
    
    db.delete(reading)
    db.commit()
    return