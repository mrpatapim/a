from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import pandas as pd
from typing import List
from app.database import get_db
from app.models.bills import Meter, MeterReading, ServiceType
from app.models.users import User
from app.schemas.analytics import AnalyticsOut, ExpenseSummary
from app.security import get_current_user

router = APIRouter(prefix="/analytics", tags=["Analytics & Pandas"])

@router.get("/summary", response_model=AnalyticsOut)
def get_expense_analytics(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    readings_query = (
        db.query(
            MeterReading.recorded_at,
            MeterReading.consumed_volume,
            MeterReading.calculated_cost,
            ServiceType.name.label("service_name"),
            ServiceType.unit.label("unit")
        )
        .join(Meter, MeterReading.meter_id == Meter.id)
        .join(ServiceType, Meter.service_type_id == ServiceType.id)
        .filter(Meter.user_id == current_user.id)
        .all()
    )

    if not readings_query:
        return AnalyticsOut(
            user_id=current_user.id,
            period_start=None,
            period_end=None,
            summary_by_service=[],
            monthly_trend={}
        )

    raw_data = [
        {
            "date": r.recorded_at,
            "volume": r.consumed_volume if r.consumed_volume else 0.0,
            "cost": r.calculated_cost if r.calculated_cost else 0.0,
            "service_name": r.service_name,
            "unit": r.unit
        }
        for r in readings_query
    ]

    df = pd.DataFrame(raw_data)
    df['date'] = pd.to_datetime(df['date'])
    
    period_start = df['date'].min().strftime("%Y-%m-%d")
    period_end = df['date'].max().strftime("%Y-%m-%d")

    summary_list = []
    grouped_service = df.groupby(['service_name', 'unit'])

    for (service_name, unit), group in grouped_service:
        total_spent = float(group['cost'].sum())
        total_volume = float(group['volume'].sum())
        
        group_by_month = group.set_index('date').resample('ME')
        unique_months_count = max(len(group_by_month), 1)
        average_monthly_spent = total_spent / unique_months_count

        summary_list.append(
            ExpenseSummary(
                service_name=service_name,
                total_spent=round(total_spent, 2),
                average_monthly_spent=round(average_monthly_spent, 2),
                total_volume=round(total_volume, 2),
                unit=unit
            )
        )

    df['year_month'] = df['date'].dt.to_period('M').astype(str)
    trend_group = df.groupby('year_month')['cost'].sum()
    monthly_trend = {str(k): round(float(v), 2) for k, v in trend_group.to_dict().items()}

    return AnalyticsOut(
        user_id=current_user.id,
        period_start=period_start,
        period_end=period_end,
        summary_by_service=summary_list,
        monthly_trend=monthly_trend
    )