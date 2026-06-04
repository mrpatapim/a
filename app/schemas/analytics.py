from pydantic import BaseModel
from typing import List, Dict

class ExpenseSummary(BaseModel):
    service_name: str
    total_spent: float
    average_monthly_spent: float
    total_volume: float
    unit: str

class AnalyticsOut(BaseModel):
    user_id: int
    period_start: str | None
    period_end: str | None
    summary_by_service: List[ExpenseSummary]
    monthly_trend: Dict[str, float]