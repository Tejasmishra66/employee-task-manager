from pydantic import BaseModel
from typing import Optional


class PredictRequest(BaseModel):
    # Employee features
    no_of_trainings: Optional[int] = 1
    age: Optional[int] = 30
    previous_year_rating: Optional[float] = 3.0
    length_of_service: Optional[int] = 3
    KPIs_met_more_than_80: Optional[int] = 0
    awards_won: Optional[int] = 0
    avg_training_score: Optional[float] = 60.0
    department: Optional[str] = "Technology"
    education: Optional[str] = "Bachelor's"
    # Project features
    Budget: Optional[float] = 100000.0
    Actual_Cost: Optional[float] = 80000.0
    Delay_Days: Optional[int] = 0
    Cost_Overrun_pct: Optional[float] = 0.0
    Project_Type: Optional[str] = "Web App"
    Priority: Optional[str] = "Medium"
    Priority_Scaled: Optional[int] = 2
    # Computed / derived features
    Tasks_Completed: Optional[int] = 5
    Productivity_Score: Optional[float] = 70.0
    Training_Effectiveness: Optional[float] = 3.0
    Experience_Index: Optional[float] = 3.0
    Workload_Pressure: Optional[float] = 0.5


class PredictResponse(BaseModel):
    predicted_hours: float
    model_mae: float
    model_rmse: float
