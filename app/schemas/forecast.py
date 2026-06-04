from pydantic import BaseModel

class ForecastOut(BaseModel):
    meter_id: int
    service_name: str
    current_tariff: float
    predicted_volume: float
    predicted_cost: float
    confidence: str