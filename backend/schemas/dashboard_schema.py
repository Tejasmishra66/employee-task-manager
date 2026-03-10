from pydantic import BaseModel, ConfigDict
from typing import Dict, List, Optional


class EmployeeSummary(BaseModel):
    employee_id: int
    employee_name: str
    total_tasks: int
    completed_tasks: int
    total_hours: float

    model_config = ConfigDict(from_attributes=True)


class ProjectSummary(BaseModel):
    project_id: int
    project_name: str
    total_tasks: int
    completed_tasks: int
    total_hours: float
    budget: Optional[float]
    actual_cost: Optional[float]

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    total_tasks: int
    tasks_by_status: Dict[str, int]
    tasks_by_priority: Dict[str, int]
    total_hours_logged: float
    total_employees: int
    total_projects: int
    top_employees: List[EmployeeSummary]
    project_summaries: List[ProjectSummary]

    model_config = ConfigDict(from_attributes=True)
