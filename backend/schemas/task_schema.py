from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    priority: Optional[str] = "Medium"    # Low / Medium / High / Critical
    employee_id: int
    project_id: int


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    employee_id: Optional[int] = None
    project_id: Optional[int] = None


class TaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    priority: Optional[str]
    status: str
    employee_id: Optional[int]
    project_id: Optional[int]
    start_time: Optional[datetime]
    end_time: Optional[datetime]
    measured_hours: Optional[float]
    estimated_hours: Optional[float]

    model_config = ConfigDict(from_attributes=True)
