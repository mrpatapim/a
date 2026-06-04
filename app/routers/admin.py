from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models.users import User
from app.models.bills import Meter, ServiceType, MeterReading
from app.schemas.users import UserOut
from app.schemas.bills import ServiceTypeCreate, ServiceTypeOut
from app.security import require_admin

router = APIRouter(prefix="/admin", tags=["Admin Operations"])


@router.get("/stats")
def get_system_stats(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    users_count = db.query(User).filter(User.is_admin == False).count()
    meters_count = db.query(Meter).count()
    readings_count = db.query(MeterReading).count()
    total_revenue = db.query(func.coalesce(func.sum(MeterReading.calculated_cost), 0.0)).scalar()
    return {
        "total_users": users_count,
        "total_meters": meters_count,
        "total_readings": readings_count,
        "total_revenue": round(float(total_revenue or 0.0), 2),
    }


@router.get("/revenue")
def get_system_revenue(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    results = (
        db.query(ServiceType.name, func.coalesce(func.sum(MeterReading.calculated_cost), 0.0))
        .select_from(ServiceType)
        .join(Meter, Meter.service_type_id == ServiceType.id)
        .join(MeterReading, MeterReading.meter_id == Meter.id)
        .group_by(ServiceType.name)
        .all()
    )
    return [{"service_name": r[0], "total_revenue": round(float(r[1] or 0.0), 2)} for r in results]


@router.get("/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    return db.query(User).filter(User.is_admin == False).order_by(User.id.asc()).all()


@router.get("/users/{user_id}/meters")
def get_any_user_meters(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    meters = (
        db.query(Meter)
        .options(joinedload(Meter.service_type))
        .filter(Meter.user_id == user_id)
        .order_by(Meter.id.asc())
        .all()
    )

    result = []
    for m in meters:
        readings = (
            db.query(MeterReading)
            .filter(MeterReading.meter_id == m.id)
            .order_by(MeterReading.recorded_at.asc())
            .all()
        )
        total_cost = round(sum((r.calculated_cost or 0.0) for r in readings), 2)
        last_reading = readings[-1].recorded_at.isoformat() if readings else None
        result.append({
            "id": m.id,
            "user_id": m.user_id,
            "service_type_id": m.service_type_id,
            "service_name": m.service_type.name if m.service_type else "—",
            "unit": m.service_type.unit if m.service_type else "",
            "serial_number": m.serial_number,
            "current_tariff": m.current_tariff,
            "readings_count": len(readings),
            "total_cost": total_cost,
            "last_reading": last_reading,
        })
    return result


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    user_to_delete = db.query(User).filter(User.id == user_id, User.is_admin == False).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user_to_delete)
    db.commit()
    return


@router.post("/service-types", response_model=ServiceTypeOut, status_code=status.HTTP_201_CREATED)
def create_service_type(service: ServiceTypeCreate, db: Session = Depends(get_db), current_user: User = Depends(require_admin)):
    existing = db.query(ServiceType).filter(ServiceType.name == service.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service type already exists")

    new_service = ServiceType(name=service.name, unit=service.unit)
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service
