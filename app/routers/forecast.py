from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from app.database import get_db
from app.models.bills import Meter, MeterReading, ServiceType
from app.models.users import User
from app.schemas.forecast import ForecastOut
from app.security import get_current_user

router = APIRouter(prefix="/forecast", tags=["Forecast & Machine Learning"])

@router.get("/{meter_id}", response_model=ForecastOut)
def get_meter_forecast(meter_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    meter = db.query(Meter).filter(Meter.id == meter_id, Meter.user_id == current_user.id).first()
    if not meter:
        raise HTTPException(status_code=404, detail="Meter not found")
        
    service_type = db.query(ServiceType).filter(ServiceType.id == meter.service_type_id).first()
    service_name = service_type.name if service_type else "Неизвестная услуга"

    readings = db.query(MeterReading).filter(MeterReading.meter_id == meter_id).order_by(MeterReading.recorded_at.asc()).all()
    
    if len(readings) < 3:
        raise HTTPException(
            status_code=400, 
            detail="Недостаточно данных для прогнозирования. Внесите минимум 3 показания."
        )

    raw_data = [
        {
            "date": r.recorded_at,
            "volume": r.consumed_volume if r.consumed_volume else 0.0
        }
        for r in readings
    ]
    
    df = pd.DataFrame(raw_data)
    df['date'] = pd.to_datetime(df['date'])
    
    df['days_from_start'] = (df['date'] - df['date'].min()).dt.days

    X = df[['days_from_start']].values
    y = df['volume'].values

    model = LinearRegression()
    model.fit(X, y)

    last_days = int(df['days_from_start'].max())
    next_month_days = last_days + 30
    
    predicted_volume = float(model.predict(np.array([[next_month_days]]))[0])
    
    if predicted_volume < 0:
        predicted_volume = float(df['volume'].mean())

    predicted_cost = predicted_volume * meter.current_tariff

    return ForecastOut(
        meter_id=meter.id,
        service_name=service_name,
        current_tariff=meter.current_tariff,
        predicted_volume=round(predicted_volume, 2),
        predicted_cost=round(predicted_cost, 2),
        confidence="На основе линейного тренда (Scikit-learn)"
    )