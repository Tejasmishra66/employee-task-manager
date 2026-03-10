"""
test_api.py — Integration tests for the FastAPI endpoints.

Run from project root:
    pytest test/test_api.py -v
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.database.db_config import Base, get_db
from backend.database import models
from backend.app import app

# ── In-memory test database ───────────────────────────────────────────────────
# StaticPool forces all sessions to re-use the same in-memory connection so
# tables created by the fixture are visible to all requests.

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=test_engine)
    yield
    Base.metadata.drop_all(bind=test_engine)


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


# ── Helper: seed an employee + project ───────────────────────────────────────

def create_employee():
    res = client.post("/employees", json={
        "name": "Alice Tester",
        "department": "Technology",
        "education": "Bachelor's",
        "age": 28,
        "previous_year_rating": 4.0,
        "length_of_service": 3,
    })
    assert res.status_code == 201
    return res.json()


def create_project():
    res = client.post("/projects", json={
        "name": "Test Project",
        "project_type": "Web App",
        "priority": "High",
        "budget": 50000.0,
    })
    assert res.status_code == 201
    return res.json()


# ── Health check ──────────────────────────────────────────────────────────────

def test_root():
    res = client.get("/")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


# ── Employee CRUD ─────────────────────────────────────────────────────────────

def test_create_and_list_employee():
    emp = create_employee()
    assert emp["name"] == "Alice Tester"
    assert emp["department"] == "Technology"

    res = client.get("/employees")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_get_employee():
    emp = create_employee()
    res = client.get(f"/employees/{emp['id']}")
    assert res.status_code == 200
    assert res.json()["id"] == emp["id"]


def test_get_employee_not_found():
    res = client.get("/employees/999")
    assert res.status_code == 404


def test_update_employee():
    emp = create_employee()
    res = client.put(f"/employees/{emp['id']}", json={"department": "Analytics"})
    assert res.status_code == 200
    assert res.json()["department"] == "Analytics"


def test_delete_employee():
    emp = create_employee()
    res = client.delete(f"/employees/{emp['id']}")
    assert res.status_code == 200
    assert client.get(f"/employees/{emp['id']}").status_code == 404


# ── Project CRUD ──────────────────────────────────────────────────────────────

def test_create_and_list_project():
    proj = create_project()
    assert proj["name"] == "Test Project"

    res = client.get("/projects")
    assert res.status_code == 200
    assert len(res.json()) == 1


def test_get_project_not_found():
    res = client.get("/projects/999")
    assert res.status_code == 404


def test_update_project():
    proj = create_project()
    res = client.put(f"/projects/{proj['id']}", json={"status": "Completed"})
    assert res.status_code == 200
    assert res.json()["status"] == "Completed"


# ── Task CRUD & lifecycle ─────────────────────────────────────────────────────

def test_create_task():
    emp = create_employee()
    proj = create_project()
    res = client.post("/tasks", json={
        "title": "Build Login Page",
        "description": "React form with JWT auth",
        "priority": "High",
        "employee_id": emp["id"],
        "project_id": proj["id"],
    })
    assert res.status_code == 201
    task = res.json()
    assert task["status"] == "Pending"
    assert task["measured_hours"] is None


def test_task_lifecycle():
    emp = create_employee()
    proj = create_project()
    task = client.post("/tasks", json={
        "title": "API Integration",
        "employee_id": emp["id"],
        "project_id": proj["id"],
    }).json()

    # Start
    started = client.post(f"/tasks/{task['id']}/start").json()
    assert started["status"] == "In Progress"
    assert started["start_time"] is not None

    # Stop
    stopped = client.post(f"/tasks/{task['id']}/stop").json()
    assert stopped["status"] == "Completed"
    assert stopped["measured_hours"] is not None
    assert stopped["measured_hours"] >= 0


def test_task_not_found():
    res = client.get("/tasks/9999")
    assert res.status_code == 404


def test_stop_unstarted_task():
    emp = create_employee()
    proj = create_project()
    task = client.post("/tasks", json={
        "title": "New Task",
        "employee_id": emp["id"],
        "project_id": proj["id"],
    }).json()
    res = client.post(f"/tasks/{task['id']}/stop")
    assert res.status_code == 400


# ── Employee tasks sub-route ──────────────────────────────────────────────────

def test_employee_tasks():
    emp = create_employee()
    proj = create_project()
    client.post("/tasks", json={"title": "T1", "employee_id": emp["id"], "project_id": proj["id"]})
    client.post("/tasks", json={"title": "T2", "employee_id": emp["id"], "project_id": proj["id"]})

    res = client.get(f"/employees/{emp['id']}/tasks")
    assert res.status_code == 200
    assert len(res.json()) == 2


# ── Dashboard ─────────────────────────────────────────────────────────────────

def test_dashboard_empty():
    res = client.get("/dashboard/summary")
    assert res.status_code == 200
    data = res.json()
    assert data["total_tasks"] == 0
    assert data["total_hours_logged"] == 0.0


def test_dashboard_with_data():
    emp = create_employee()
    proj = create_project()
    task = client.post("/tasks", json={
        "title": "Dashboard Task",
        "employee_id": emp["id"],
        "project_id": proj["id"],
    }).json()
    client.post(f"/tasks/{task['id']}/start")
    client.post(f"/tasks/{task['id']}/stop")

    res = client.get("/dashboard/summary")
    data = res.json()
    assert data["total_tasks"] == 1
    assert "Completed" in data["tasks_by_status"]
