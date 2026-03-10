"""
test_service.py — Unit tests for the service layer using an in-memory SQLite DB.

Run from project root:
    pytest test/test_service.py -v
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi import HTTPException

from backend.database.db_config import Base
from backend.database import models
from backend.schemas.employee_schema import EmployeeCreate, EmployeeUpdate
from backend.schemas.project_schema import ProjectCreate, ProjectUpdate
from backend.schemas.task_schema import TaskCreate
from backend.services import employee_Service, project_service, task_service

# ── In-memory DB fixture ──────────────────────────────────────────────────────

TEST_URL = "sqlite:///:memory:"
engine = create_engine(TEST_URL, connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)


@pytest.fixture()
def db():
    Base.metadata.create_all(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine)


# ── Helpers ───────────────────────────────────────────────────────────────────

def make_employee(db):
    return employee_Service.create_employee(
        db,
        EmployeeCreate(name="Bob Dev", department="Backend", education="Master's",
                       age=32, previous_year_rating=4.5, length_of_service=5),
    )


def make_project(db):
    return project_service.create_project(
        db,
        ProjectCreate(name="Portal v2", project_type="Web App", priority="High", budget=80000.0),
    )


# ── Employee service ──────────────────────────────────────────────────────────

def test_create_employee(db):
    emp = make_employee(db)
    assert emp.id is not None
    assert emp.name == "Bob Dev"


def test_get_employee(db):
    emp = make_employee(db)
    fetched = employee_Service.get_employee(db, emp.id)
    assert fetched.id == emp.id


def test_get_employee_missing_raises(db):
    with pytest.raises(HTTPException) as exc:
        employee_Service.get_employee(db, 9999)
    assert exc.value.status_code == 404


def test_update_employee(db):
    emp = make_employee(db)
    updated = employee_Service.update_employee(db, emp.id, EmployeeUpdate(department="Full Stack"))
    assert updated.department == "Full Stack"


def test_delete_employee(db):
    emp = make_employee(db)
    employee_Service.delete_employee(db, emp.id)
    with pytest.raises(HTTPException):
        employee_Service.get_employee(db, emp.id)


# ── Project service ───────────────────────────────────────────────────────────

def test_create_project(db):
    proj = make_project(db)
    assert proj.id is not None
    assert proj.name == "Portal v2"


def test_get_project_missing_raises(db):
    with pytest.raises(HTTPException) as exc:
        project_service.get_project(db, 9999)
    assert exc.value.status_code == 404


def test_update_project(db):
    proj = make_project(db)
    updated = project_service.update_project(db, proj.id, ProjectUpdate(status="Completed"))
    assert updated.status == "Completed"


# ── Task service ──────────────────────────────────────────────────────────────

def test_create_task(db):
    emp = make_employee(db)
    proj = make_project(db)
    task = task_service.create_task(
        db,
        TaskCreate(title="Write unit tests", employee_id=emp.id, project_id=proj.id),
    )
    assert task.status == "Pending"
    assert task.measured_hours is None


def test_create_task_invalid_employee(db):
    proj = make_project(db)
    with pytest.raises(HTTPException) as exc:
        task_service.create_task(db, TaskCreate(title="T", employee_id=999, project_id=proj.id))
    assert exc.value.status_code == 404


def test_start_task(db):
    emp = make_employee(db)
    proj = make_project(db)
    task = task_service.create_task(
        db, TaskCreate(title="API endpoint", employee_id=emp.id, project_id=proj.id)
    )
    started = task_service.start_task(db, task.id)
    assert started.status == "In Progress"
    assert started.start_time is not None


def test_stop_task(db):
    emp = make_employee(db)
    proj = make_project(db)
    task = task_service.create_task(
        db, TaskCreate(title="Deploy app", employee_id=emp.id, project_id=proj.id)
    )
    task_service.start_task(db, task.id)
    stopped = task_service.stop_task(db, task.id)
    assert stopped.status == "Completed"
    assert stopped.measured_hours is not None
    assert stopped.measured_hours >= 0


def test_stop_unstarted_task_raises(db):
    emp = make_employee(db)
    proj = make_project(db)
    task = task_service.create_task(
        db, TaskCreate(title="Unstarted", employee_id=emp.id, project_id=proj.id)
    )
    with pytest.raises(HTTPException) as exc:
        task_service.stop_task(db, task.id)
    assert exc.value.status_code == 400


def test_dashboard_summary(db):
    emp = make_employee(db)
    proj = make_project(db)
    task = task_service.create_task(
        db, TaskCreate(title="Summary task", employee_id=emp.id, project_id=proj.id)
    )
    task_service.start_task(db, task.id)
    task_service.stop_task(db, task.id)

    summary = task_service.get_dashboard_summary(db)
    assert summary["total_tasks"] == 1
    assert summary["tasks_by_status"]["Completed"] == 1
    assert summary["total_hours_logged"] >= 0
