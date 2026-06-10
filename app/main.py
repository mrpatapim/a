from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from datetime import datetime
import os

from app.database import engine, Base, SessionLocal
from app.models.users import User
from app.models.bills import ServiceType, Meter, MeterReading
from app.security import get_password_hash
from app.routers import auth, bills as bills_router, analytics, forecast, admin
from app.config import YANDEX_MAPS_API_KEY

INITIAL_SERVICES = [
    {"name": "Холодное водоснабжение", "unit": "м³"},
    {"name": "Горячее водоснабжение", "unit": "м³"},
    {"name": "Электроснабжение", "unit": "кВт·ч"},
    {"name": "Газоснабжение", "unit": "м³"},
    {"name": "Отопление", "unit": "Гкал"},
]

DEMO_USERS = [
    {
        "username": "Петров",
        "email": "petrov@samara.ru",
        "password": "user1234",
        "street": "ул. Ново-Садовая",
        "house": "21",
        "apartment": "15",
        "floor": "4",
        "monthly_budget": 6000.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-001", "current_tariff": 5.73, "readings": [12450, 12750, 13090, 13450]},
            {"service_type_id": 1, "serial_number": "ХВ-2026-001", "current_tariff": 42.30, "readings": [200, 212, 225, 239]},
        ],
    },
    {
        "username": "Смирнова",
        "email": "smirnova@samara.ru",
        "password": "user1234",
        "street": "ул. Куйбышева",
        "house": "103",
        "apartment": "44",
        "floor": "7",
        "monthly_budget": 4000.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-002", "current_tariff": 5.73, "readings": [9800, 10080, 10380, 10710]},
            {"service_type_id": 2, "serial_number": "ГВ-2026-002", "current_tariff": 165.00, "readings": [140, 146, 153, 160]},
            {"service_type_id": 4, "serial_number": "ГЗ-2026-002", "current_tariff": 8.10, "readings": [540, 558, 578, 600]},
        ],
    },
    {
        "username": "Козлов",
        "email": "kozlov@samara.ru",
        "password": "user1234",
        "street": "ул. Полевая",
        "house": "4",
        "apartment": "12",
        "floor": "2",
        "monthly_budget": 2800.0,
        "meters": [
            {"service_type_id": 3, "serial_number": "ЭЛ-2026-003", "current_tariff": 5.73, "readings": [7300, 7550, 7820, 8120]},
            {"service_type_id": 5, "serial_number": "ОТ-2026-003", "current_tariff": 2150.00, "readings": [3.0, 3.5, 4.05, 4.60]},
        ],
    },
]


def build_reading_dates():
    now = datetime.now().replace(hour=12, minute=0, second=0, microsecond=0)

    def first_of_prev_month(base, months_back):
        year = base.year
        month = base.month - months_back
        while month <= 0:
            month += 12
            year -= 1
        return datetime(year, month, 1, 12, 0, 0)

    return [
        first_of_prev_month(now, 3),
        first_of_prev_month(now, 2),
        first_of_prev_month(now, 1),
        now,
    ]


def seed_database():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(ServiceType).count() == 0:
            db.add_all([ServiceType(name=s["name"], unit=s["unit"]) for s in INITIAL_SERVICES])
            db.commit()

        if not db.query(User).filter(User.username == "Админ").first():
            db.add(User(
                username="Админ",
                email="admin@samara.ru",
                hashed_password=get_password_hash("admin1234"),
                street="ул. Галактионовская",
                house="141",
                apartment="1",
                floor="1",
                monthly_budget=0.0,
                is_admin=True,
            ))
            db.commit()

        if db.query(User).filter(User.is_admin == False).count() == 0:
            dates = build_reading_dates()
            for demo in DEMO_USERS:
                user = User(
                    username=demo["username"],
                    email=demo["email"],
                    hashed_password=get_password_hash(demo["password"]),
                    street=demo["street"],
                    house=demo["house"],
                    apartment=demo["apartment"],
                    floor=demo["floor"],
                    monthly_budget=demo["monthly_budget"],
                    is_admin=False,
                )
                db.add(user)
                db.commit()
                db.refresh(user)

                for meter_data in demo["meters"]:
                    meter = Meter(
                        user_id=user.id,
                        service_type_id=meter_data["service_type_id"],
                        serial_number=meter_data["serial_number"],
                        current_tariff=meter_data["current_tariff"],
                    )
                    db.add(meter)
                    db.commit()
                    db.refresh(meter)

                    previous = None
                    for index, value in enumerate(meter_data["readings"]):
                        volume = 0.0 if previous is None else round(value - previous, 4)
                        cost = round(volume * meter_data["current_tariff"], 2)
                        db.add(MeterReading(
                            meter_id=meter.id,
                            reading_value=value,
                            consumed_volume=volume,
                            calculated_cost=cost,
                            recorded_at=dates[index],
                        ))
                        previous = value
                    db.commit()
    finally:
        db.close()


seed_database()

app = FastAPI(
    title="Система учета коммунальных услуг",
    description="Интеллектуальная система учета, анализа и прогнозирования ЖКХ",
    version="10.0.0",
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


@app.get("/api/config")
def get_public_config():
    return {"yandex_maps_api_key": YANDEX_MAPS_API_KEY}
