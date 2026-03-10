"""
app.py — FastAPI entry point for the Employee Task & Time Management System.

Start the server from the project root:
    uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List

from backend.database.db_config import engine, get_db
from backend.database import models

# Services
from backend.services import employee_Service, task_service
from backend.services import project_service

# Schemas
from backend.schemas.employee_schema import EmployeeCreate, EmployeeUpdate, EmployeeResponse
from backend.schemas.project_schema import ProjectCreate, ProjectUpdate, ProjectResponse
from backend.schemas.task_schema import TaskCreate, TaskUpdate, TaskResponse
from backend.schemas.dashboard_schema import DashboardSummary
from backend.schemas.predict_schema import PredictRequest, PredictResponse

# ── App setup ─────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Create all database tables on server start (idempotent)."""
    models.Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Employee Task & Time Management System",
    description=(
        "Backend API for tracking IT project tasks, employee performance, "
        "time logging, and ML-based hour estimation."
    ),
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "message": "Employee Task & Time Management API v2.0"}


# ── Employee endpoints ────────────────────────────────────────────────────────

@app.get("/employees", response_model=List[EmployeeResponse], tags=["Employees"])
def list_employees(db: Session = Depends(get_db)):
    return employee_Service.get_all_employees(db)


@app.post("/employees", response_model=EmployeeResponse, status_code=201, tags=["Employees"])
def add_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    return employee_Service.create_employee(db, data)


@app.get("/employees/{employee_id}", response_model=EmployeeResponse, tags=["Employees"])
def get_employee(employee_id: int, db: Session = Depends(get_db)):
    return employee_Service.get_employee(db, employee_id)


@app.put("/employees/{employee_id}", response_model=EmployeeResponse, tags=["Employees"])
def edit_employee(employee_id: int, data: EmployeeUpdate, db: Session = Depends(get_db)):
    return employee_Service.update_employee(db, employee_id, data)


@app.delete("/employees/{employee_id}", tags=["Employees"])
def remove_employee(employee_id: int, db: Session = Depends(get_db)):
    return employee_Service.delete_employee(db, employee_id)


@app.get("/employees/{employee_id}/tasks", response_model=List[TaskResponse], tags=["Employees"])
def employee_tasks(employee_id: int, db: Session = Depends(get_db)):
    return employee_Service.get_employee_tasks(db, employee_id)


# ── Project endpoints ─────────────────────────────────────────────────────────

@app.get("/projects", response_model=List[ProjectResponse], tags=["Projects"])
def list_projects(db: Session = Depends(get_db)):
    return project_service.get_all_projects(db)


@app.post("/projects", response_model=ProjectResponse, status_code=201, tags=["Projects"])
def add_project(data: ProjectCreate, db: Session = Depends(get_db)):
    return project_service.create_project(db, data)


@app.get("/projects/{project_id}", response_model=ProjectResponse, tags=["Projects"])
def get_project(project_id: int, db: Session = Depends(get_db)):
    return project_service.get_project(db, project_id)


@app.put("/projects/{project_id}", response_model=ProjectResponse, tags=["Projects"])
def edit_project(project_id: int, data: ProjectUpdate, db: Session = Depends(get_db)):
    return project_service.update_project(db, project_id, data)


@app.delete("/projects/{project_id}", tags=["Projects"])
def remove_project(project_id: int, db: Session = Depends(get_db)):
    return project_service.delete_project(db, project_id)


@app.get("/projects/{project_id}/tasks", response_model=List[TaskResponse], tags=["Projects"])
def project_tasks(project_id: int, db: Session = Depends(get_db)):
    return project_service.get_project_tasks(db, project_id)


# ── Task endpoints ────────────────────────────────────────────────────────────

@app.get("/tasks", response_model=List[TaskResponse], tags=["Tasks"])
def list_tasks(db: Session = Depends(get_db)):
    return task_service.get_all_tasks(db)


@app.post("/tasks", response_model=TaskResponse, status_code=201, tags=["Tasks"])
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    return task_service.create_task(db, data)


@app.get("/tasks/{task_id}", response_model=TaskResponse, tags=["Tasks"])
def get_task(task_id: int, db: Session = Depends(get_db)):
    return task_service.get_task(db, task_id)


@app.put("/tasks/{task_id}", response_model=TaskResponse, tags=["Tasks"])
def edit_task(task_id: int, data: TaskUpdate, db: Session = Depends(get_db)):
    return task_service.update_task(db, task_id, data)


@app.delete("/tasks/{task_id}", tags=["Tasks"])
def remove_task(task_id: int, db: Session = Depends(get_db)):
    return task_service.delete_task(db, task_id)


@app.post("/tasks/{task_id}/start", response_model=TaskResponse, tags=["Tasks"])
def start_task(task_id: int, db: Session = Depends(get_db)):
    """Mark task as In Progress and begin measuring time."""
    return task_service.start_task(db, task_id)


@app.post("/tasks/{task_id}/stop", response_model=TaskResponse, tags=["Tasks"])
def stop_task(task_id: int, db: Session = Depends(get_db)):
    """Mark task as Completed and record measured hours."""
    return task_service.stop_task(db, task_id)


# ── Dashboard endpoint ────────────────────────────────────────────────────────

@app.get("/dashboard/summary", response_model=DashboardSummary, tags=["Dashboard"])
def dashboard_summary(db: Session = Depends(get_db)):
    """Aggregated view: task counts, hours logged, top employees, project budgets."""
    return task_service.get_dashboard_summary(db)


# ── ML prediction endpoints ───────────────────────────────────────────────────

@app.post("/predict", response_model=PredictResponse, tags=["ML"])
def predict_hours(data: PredictRequest):
    """
    Predict how many hours a task will take.
    Run `python -m backend.ml.train_models` once before calling this endpoint.
    """
    from backend.ml import predict as ml_predict

    feature_map = {
        "no_of_trainings": data.no_of_trainings,
        "age": data.age,
        "previous_year_rating": data.previous_year_rating,
        "length_of_service": data.length_of_service,
        "KPIs_met_more_than_80": data.KPIs_met_more_than_80,
        "awards_won": data.awards_won,
        "avg_training_score": data.avg_training_score,
        "Budget": data.Budget,
        "Actual Cost": data.Actual_Cost,
        "Delay Days": data.Delay_Days,
        "Cost Overrun %": data.Cost_Overrun_pct,
        "Tasks Completed": data.Tasks_Completed,
        "Productivity Score": data.Productivity_Score,
        "Training Effectiveness": data.Training_Effectiveness,
        "Experience Index": data.Experience_Index,
        "Priority_Scaled": data.Priority_Scaled,
        "Workload Pressure": data.Workload_Pressure,
        "department": data.department,
        "education": data.education,
        "Project Type": data.Project_Type,
        "Priority": data.Priority,
    }

    try:
        hours = ml_predict.predict(feature_map)
        meta = ml_predict.get_metadata()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))

    return PredictResponse(
        predicted_hours=hours,
        model_mae=meta.get("metrics", {}).get("mae", 0.0),
        model_rmse=meta.get("metrics", {}).get("rmse", 0.0),
    )


@app.get("/model-info", tags=["ML"])
def model_info():
    """Returns metadata about the currently loaded prediction model."""
    from backend.ml import predict as ml_predict
    try:
        return ml_predict.get_metadata()
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))