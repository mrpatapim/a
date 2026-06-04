from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.database import engine, Base, SessionLocal
from app.models import users, bills 
from app.models.bills import ServiceType, Meter, MeterReading
from app.models.users import User
from app.security import get_password_hash
from app.routers import auth, bills as bills_router, analytics, forecast, admin
import os
from datetime import datetime

Base.metadata.create_all(bind=engine)

db = SessionLocal()
if db.query(ServiceType).count() == 0:
    initial_services = [
        ServiceType(name="Холодное водоснабжение", unit="м³"),
        ServiceType(name="Горячее водоснабжение", unit="м³"),
        ServiceType(name="Электроснабжение", unit="кВт·ч"),
        ServiceType(name="Газоснабжение", unit="м³"),
        ServiceType(name="Отопление", unit="Гкал")
    ]
    db.add_all(initial_services)
    db.commit()

admin_user = db.query(User).filter(User.username == "Админ").first()
if not admin_user:
    hashed_pwd = get_password_hash("admin1234")
    default_admin = User(
        username="Админ",
        email="admin@mail.ru",
        hashed_password=hashed_pwd,
        street="ул. Галактионовская",
        house="141",
        apartment="1",
        floor="1",
        monthly_budget=0.0,
        is_admin=True
    )
    db.add(default_admin)
    db.commit()

if db.query(User).filter(User.is_admin == False).count() == 0:
    mock_users = [
        {"username": "Петров", "email": "petrov@mail.ru", "street": "ул. Ново-Садовая", "house": "21", "apt": "15", "fl": "4", "pass": "user1234"},
        {"username": "Смирнова", "email": "smirnovai@mail.ru", "street": "ул. Куйбышева", "house": "103", "apt": "44", "fl": "7", "pass": "user1234"},
        {"username": "Козлов", "email": "kozlovm@mail.ru", "street": "ул. Полевая", "house": "4", "apt": "12", "fl": "2", "pass": "user1234"}
    ]
    
    for mu in mock_users:
        new_u = User(
            username=mu["username"],
            email=mu["email"],
            hashed_password=get_password_hash(mu["pass"]),
            street=mu["street"],
            house=mu["house"],
            apartment=mu["apt"],
            floor=mu["fl"],
            monthly_budget=5000.0,
            is_admin=False
        )
        db.add(new_u)
        db.commit()
        db.refresh(new_u)
        
        meter_el = Meter(user_id=new_u.id, service_type_id=3, serial_number=f"ЭЛ-{new_u.id}-2026", current_tariff=5.50)
        meter_w = Meter(user_id=new_u.id, service_type_id=1, serial_number=f"ХВ-{new_u.id}-2026", current_tariff=35.00)
        db.add_all([meter_el, meter_w])
        db.commit()
        db.refresh(meter_el)
        db.refresh(meter_w)
        
        readings_data = [
            {"val_el": 100.0, "val_w": 10.0, "date": datetime(2026, 3, 1)},
            {"val_el": 220.0, "val_w": 16.0, "date": datetime(2026, 4, 1)},
            {"val_el": 350.0, "val_w": 23.0, "date": datetime(2026, 5, 1)},
            {"val_el": 490.0, "val_w": 29.0, "date": datetime(2026, 6, 1)}
        ]
        
        prev_el, prev_w = None, None
        for r in readings_data:
            vol_el = r["val_el"] - prev_el if prev_el is not None else 0.0
            vol_w = r["val_w"] - prev_w if prev_w is not None else 0.0
            
            rd_el = MeterReading(meter_id=meter_el.id, reading_value=r["val_el"], consumed_volume=vol_el, calculated_cost=vol_el*5.50, recorded_at=r["date"])
            rd_w = MeterReading(meter_id=meter_w.id, reading_value=r["val_w"], consumed_volume=vol_w, calculated_cost=vol_w*35.00, recorded_at=r["date"])
            db.add_all([rd_el, rd_w])
            
            prev_el = r["val_el"]
            prev_w = r["val_w"]
            
        db.commit()

db.close()

app = FastAPI(
    title="Система учета коммунальных услуг",
    description="API для диплома ВКР",
    version="1.0.0"
)

app.include_router(auth.router)
app.include_router(bills_router.router)
app.include_router(analytics.router)
app.include_router(forecast.router)
app.include_router(admin.router)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
def route_login():
    return FileResponse(os.path.join(static_dir, "index.html"))

@app.get("/dashboard")
def route_dashboard():
    return FileResponse(os.path.join(static_dir, "dashboard.html"))