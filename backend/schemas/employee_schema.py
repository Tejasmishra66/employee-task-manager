from pydantic import BaseModel, ConfigDict
from typing import Optional


class EmployeeCreate(BaseModel):
    name: str
    department: str
    education: str
    no_of_trainings: Optional[int] = 0
    age: Optional[int] = None
    previous_year_rating: Optional[float] = None
    length_of_service: Optional[int] = None
    KPIs_met_more_than_80: Optional[int] = 0   # 0 or 1
    awards_won: Optional[int] = 0              # 0 or 1
    avg_training_score: Optional[float] = None


class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    education: Optional[str] = None
    no_of_trainings: Optional[int] = None
    age: Optional[int] = None
    previous_year_rating: Optional[float] = None
    length_of_service: Optional[int] = None
    KPIs_met_more_than_80: Optional[int] = None
    awards_won: Optional[int] = None
    avg_training_score: Optional[float] = None


class EmployeeResponse(BaseModel):
    id: int
    name: str
    department: Optional[str]
    education: Optional[str]
    no_of_trainings: Optional[int]
    age: Optional[int]
    previous_year_rating: Optional[float]
    length_of_service: Optional[int]
    KPIs_met_more_than_80: Optional[int]
    awards_won: Optional[int]
    avg_training_score: Optional[float]

    model_config = ConfigDict(from_attributes=True)
