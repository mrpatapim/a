from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.database import get_db
from app.models.users import User
from app.models.bills import Meter, ServiceType, MeterReading
from app.schemas.users import UserOut
from app.schemas.bills import MeterOut, ServiceTypeCreate, ServiceTypeOut
from app.security import get_current_user

router = APIRouter(prefix="/admin", tags=["Admin Operations"])

@router.get("/stats")
def get_system_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    users_count = db.query(User).filter(User.is_admin == False).count()
    meters_count = db.query(Meter).count()
    return {"total_users": users_count, "total_meters": meters_count}

@router.get("/revenue")
def get_system_revenue(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    
    results = db.query(
        ServiceType.name, 
        func.sum(MeterReading.calculated_cost)
    ).select_from(ServiceType).join(Meter).join(MeterReading).group_by(ServiceType.name).all()
    
    return [{"service_name": r[0], "total_revenue": r[1] or 0.0} for r in results]

@router.get("/users", response_model=List[UserOut])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    return db.query(User).filter(User.is_admin == False).all()

@router.get("/users/{user_id}/meters", response_model=List[MeterOut])
def get_any_user_meters(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    return db.query(Meter).filter(Meter.user_id == user_id).all()

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    user_to_delete = db.query(User).filter(User.id == user_id, User.is_admin == False).first()
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")
    
    db.delete(user_to_delete)
    db.commit()
    return

@router.post("/service-types", response_model=ServiceTypeOut, status_code=status.HTTP_201_CREATED)
def create_service_type(service: ServiceTypeCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Access denied. Admin role required.")
    
    existing = db.query(ServiceType).filter(ServiceType.name == service.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Service type already exists")
        
    new_service = ServiceType(name=service.name, unit=service.unit)
    db.add(new_service)
    db.commit()
    db.refresh(new_service)
    return new_service