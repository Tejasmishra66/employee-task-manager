from sqlalchemy.orm import Session
from fastapi import HTTPException
from datetime import datetime

from backend.database import models
from backend.schemas.task_schema import TaskCreate, TaskUpdate


# ── CRUD ──────────────────────────────────────────────────────────────────────

def get_all_tasks(db: Session):
    return db.query(models.Task).all()


def get_task(db: Session, task_id: int):
    task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return task


def create_task(db: Session, data: TaskCreate):
    # Verify employee and project exist
    employee = db.query(models.Employee).filter(models.Employee.id == data.employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee {data.employee_id} not found")

    project = db.query(models.Project).filter(models.Project.id == data.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {data.project_id} not found")

    task = models.Task(**data.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


def update_task(db: Session, task_id: int, data: TaskUpdate):
    task = get_task(db, task_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(task, field, value)
    db.commit()
    db.refresh(task)
    return task


def delete_task(db: Session, task_id: int):
    task = get_task(db, task_id)
    db.delete(task)
    db.commit()
    return {"detail": f"Task {task_id} deleted"}


# ── Lifecycle: start / stop ────────────────────────────────────────────────────

def start_task(db: Session, task_id: int):
    task = get_task(db, task_id)
    if task.status == "Completed":
        raise HTTPException(status_code=400, detail="Cannot restart a completed task")
    task.status = "In Progress"
    task.start_time = datetime.now()
    db.commit()
    db.refresh(task)
    return task


def stop_task(db: Session, task_id: int):
    task = get_task(db, task_id)
    if not task.start_time:
        raise HTTPException(status_code=400, detail="Task has not been started yet")
    if task.status == "Completed":
        raise HTTPException(status_code=400, detail="Task is already completed")
    task.status = "Completed"
    task.end_time = datetime.now()
    task.measured_hours = (task.end_time - task.start_time).total_seconds() / 3600
    db.commit()
    db.refresh(task)
    return task


# ── Dashboard aggregation ─────────────────────────────────────────────────────

def get_dashboard_summary(db: Session):
    tasks = db.query(models.Task).all()
    employees = db.query(models.Employee).all()
    projects = db.query(models.Project).all()

    tasks_by_status: dict = {}
    tasks_by_priority: dict = {}
    total_hours = 0.0

    for task in tasks:
        tasks_by_status[task.status] = tasks_by_status.get(task.status, 0) + 1
        pri = task.priority or "Unknown"
        tasks_by_priority[pri] = tasks_by_priority.get(pri, 0) + 1
        if task.measured_hours:
            total_hours += task.measured_hours

    # Per-employee stats
    emp_stats: dict = {}
    for task in tasks:
        eid = task.employee_id
        if eid not in emp_stats:
            emp_stats[eid] = {"total": 0, "completed": 0, "hours": 0.0}
        emp_stats[eid]["total"] += 1
        if task.status == "Completed":
            emp_stats[eid]["completed"] += 1
        if task.measured_hours:
            emp_stats[eid]["hours"] += task.measured_hours

    emp_lookup = {e.id: e.name for e in employees}
    top_employees = [
        {
            "employee_id": eid,
            "employee_name": emp_lookup.get(eid, "Unknown"),
            "total_tasks": stats["total"],
            "completed_tasks": stats["completed"],
            "total_hours": round(stats["hours"], 2),
        }
        for eid, stats in sorted(emp_stats.items(), key=lambda x: -x[1]["completed"])
    ]

    # Per-project stats
    proj_stats: dict = {}
    for task in tasks:
        pid = task.project_id
        if pid not in proj_stats:
            proj_stats[pid] = {"total": 0, "completed": 0, "hours": 0.0}
        proj_stats[pid]["total"] += 1
        if task.status == "Completed":
            proj_stats[pid]["completed"] += 1
        if task.measured_hours:
            proj_stats[pid]["hours"] += task.measured_hours

    proj_lookup = {p.id: p for p in projects}
    project_summaries = [
        {
            "project_id": pid,
            "project_name": proj_lookup[pid].name if pid in proj_lookup else "Unknown",
            "total_tasks": stats["total"],
            "completed_tasks": stats["completed"],
            "total_hours": round(stats["hours"], 2),
            "budget": proj_lookup[pid].budget if pid in proj_lookup else None,
            "actual_cost": proj_lookup[pid].actual_cost if pid in proj_lookup else None,
        }
        for pid, stats in proj_stats.items()
    ]

    return {
        "total_tasks": len(tasks),
        "tasks_by_status": tasks_by_status,
        "tasks_by_priority": tasks_by_priority,
        "total_hours_logged": round(total_hours, 2),
        "total_employees": len(employees),
        "total_projects": len(projects),
        "top_employees": top_employees,
        "project_summaries": project_summaries,
    }
