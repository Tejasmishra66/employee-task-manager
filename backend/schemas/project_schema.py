from pydantic import BaseModel, ConfigDict
from typing import Optional
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str
    project_type: str                              # e.g. "Web App", "Mobile App"
    priority: Optional[str] = "Medium"            # Low / Medium / High / Critical
    status: Optional[str] = "In Progress"
    start_date: Optional[datetime] = None
    planned_completion_date: Optional[datetime] = None
    budget: Optional[float] = 0.0


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    project_type: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[datetime] = None
    planned_completion_date: Optional[datetime] = None
    actual_completion_date: Optional[datetime] = None
    budget: Optional[float] = None
    actual_cost: Optional[float] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    project_type: Optional[str]
    priority: Optional[str]
    status: Optional[str]
    start_date: Optional[datetime]
    planned_completion_date: Optional[datetime]
    actual_completion_date: Optional[datetime]
    budget: Optional[float]
    actual_cost: Optional[float]

    model_config = ConfigDict(from_attributes=True)
