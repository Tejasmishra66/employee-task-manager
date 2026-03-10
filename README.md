# Employee Task & Time Management System

A production-ready FastAPI backend for IT companies to manage employees, projects, and tasks across foreign client engagements. Includes automatic time tracking, team dashboards, and an ML model that predicts how many hours a task will take before work begins.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Setup](#setup)
3. [Running the Server](#running-the-server)
4. [API Reference](#api-reference)
   - [Health](#health)
   - [Employees](#employees)
   - [Projects](#projects)
   - [Tasks](#tasks)
   - [Dashboard](#dashboard)
   - [ML Prediction](#ml-prediction)
5. [ML Model](#ml-model)
6. [Running Tests](#running-tests)
7. [Field Reference](#field-reference)

---

## Architecture

```
employee/
├── backend/
│   ├── app.py                  ← FastAPI entry point, all routes
│   ├── database/
│   │   ├── db_config.py        ← SQLAlchemy engine + session
│   │   └── models.py           ← ORM: Employee, Project, Task
│   ├── schemas/
│   │   ├── employee_schema.py  ← Pydantic I/O for Employee
│   │   ├── project_schema.py   ← Pydantic I/O for Project
│   │   ├── task_schema.py      ← Pydantic I/O for Task
│   │   ├── dashboard_schema.py ← Dashboard response shape
│   │   └── predict_schema.py   ← ML request / response
│   ├── services/
│   │   ├── employee_Service.py ← Employee CRUD logic
│   │   ├── project_service.py  ← Project CRUD logic
│   │   └── task_service.py     ← Task CRUD + lifecycle + dashboard
│   ├── ml/
│   │   ├── train_models.py     ← Train & save the RandomForest pipeline
│   │   ├── predict.py          ← Load model, serve predictions
│   │   └── save_models/        ← model.joblib + metadata.json (after training)
│   └── utils/
│       ├── preprocessing.py    ← Load & clean the CSV dataset
│       └── feature_engineering.py ← Feature lists + derived columns
├── test/
│   ├── test_api.py             ← 16 integration tests (TestClient)
│   └── test_service.py         ← 14 unit tests (service layer)
├── final_dataset_with_features.csv
├── tasks.db                    ← SQLite database (auto-created)
└── requirements.txt
```

**Tech stack:** FastAPI · SQLAlchemy · SQLite · Pydantic v2 · scikit-learn · pandas · pytest

---

## Setup

```powershell
# 1. Create and activate a virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# 2. Install all dependencies
pip install -r requirements.txt

# 3. Train the ML model (one-time, ~10 seconds)
python -m backend.ml.train_models
```

The training script prints MAE and RMSE, then saves the model to `backend/ml/save_models/`.

---

## Running the Server

Always run from the **project root** (`e:\6 month internship\employee`):

```powershell
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

- **Swagger UI (interactive docs):** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- The SQLite database (`tasks.db`) and all three tables are created automatically on first startup.

---

## API Reference

All request bodies are JSON. All responses are JSON.

---

### Health

#### `GET /`

Confirms the server is running.

**Response**
```json
{
  "status": "ok",
  "message": "Employee Task & Time Management API v2.0"
}
```

---

### Employees

#### `POST /employees` — Create employee

**Request body**
```json
{
  "name": "Alice Dev",
  "department": "Technology",
  "education": "Bachelor's",
  "age": 27,
  "previous_year_rating": 4.5,
  "length_of_service": 3,
  "no_of_trainings": 2,
  "KPIs_met_more_than_80": 1,
  "awards_won": 0,
  "avg_training_score": 72.0
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | **yes** | Full name |
| `department` | string | yes | e.g. Technology, Management, Analytics |
| `education` | string | yes | e.g. Bachelor's, Master's |
| `age` | int | no | Age in years |
| `previous_year_rating` | float | no | 1.0–5.0 performance rating |
| `length_of_service` | int | no | Years at company |
| `no_of_trainings` | int | no | Trainings completed (default 0) |
| `KPIs_met_more_than_80` | int | no | 1 = KPIs met >80%, 0 = not met |
| `awards_won` | int | no | 1 = won award, 0 = none |
| `avg_training_score` | float | no | 0–100 average training score |

**Response** `201 Created` — full employee object with `id`.

---

#### `GET /employees` — List all employees

No body. Returns array of employee objects.

---

#### `GET /employees/{id}` — Get one employee

Returns a single employee or `404` if not found.

---

#### `PUT /employees/{id}` — Update employee

Send only the fields you want to change:
```json
{ "department": "Full Stack", "previous_year_rating": 5.0 }
```

---

#### `DELETE /employees/{id}` — Remove employee

Returns `{ "detail": "Employee 1 deleted" }`.

---

#### `GET /employees/{id}/tasks` — All tasks assigned to this employee

Returns array of task objects. Useful for a personal task board.

---

### Projects

#### `POST /projects` — Create project

**Request body**
```json
{
  "name": "Client Portal v2",
  "project_type": "Web App",
  "priority": "High",
  "status": "In Progress",
  "start_date": "2025-01-10T09:00:00",
  "planned_completion_date": "2025-06-30T18:00:00",
  "budget": 150000.0
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | string | **yes** | Project name |
| `project_type` | string | **yes** | e.g. Web App, Mobile App, API Integration |
| `priority` | string | no | Low / Medium / High / Critical (default Medium) |
| `status` | string | no | In Progress / Completed / On Hold (default In Progress) |
| `start_date` | datetime | no | ISO 8601 format |
| `planned_completion_date` | datetime | no | ISO 8601 format |
| `budget` | float | no | Total budget in currency units |

**Response** `201 Created`.

---

#### `GET /projects` — List all projects

#### `GET /projects/{id}` — Get one project

#### `PUT /projects/{id}` — Update project

Commonly updated fields:
```json
{
  "status": "Completed",
  "actual_completion_date": "2025-07-01T12:00:00",
  "actual_cost": 138000.0
}
```

#### `DELETE /projects/{id}` — Remove project

#### `GET /projects/{id}/tasks` — All tasks under this project

---

### Tasks

Tasks represent individual work items assigned to one employee under one project.

#### `POST /tasks` — Create task

**Request body**
```json
{
  "title": "Build Login Page",
  "description": "JWT-based auth with refresh tokens",
  "priority": "High",
  "employee_id": 1,
  "project_id": 1
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | **yes** | Short task title |
| `description` | string | no | Detailed description |
| `priority` | string | no | Low / Medium / High / Critical (default Medium) |
| `employee_id` | int | **yes** | Must point to an existing employee |
| `project_id` | int | **yes** | Must point to an existing project |

New tasks always start with `"status": "Pending"`.

---

#### `GET /tasks` — List all tasks

#### `GET /tasks/{id}` — Get one task

#### `PUT /tasks/{id}` — Update task fields

#### `DELETE /tasks/{id}` — Delete task

---

#### `POST /tasks/{id}/start` — Start the timer

No body required. Marks the task as **In Progress** and records `start_time`.

**Response**
```json
{
  "id": 1,
  "title": "Build Login Page",
  "status": "In Progress",
  "start_time": "2025-03-10T14:22:05.123456",
  "end_time": null,
  "measured_hours": null,
  ...
}
```

Rules:
- Returns `400` if the task is already Completed.

---

#### `POST /tasks/{id}/stop` — Stop the timer

No body required. Marks the task as **Completed**, records `end_time`, and calculates `measured_hours` automatically.

**Response**
```json
{
  "id": 1,
  "status": "Completed",
  "start_time": "2025-03-10T14:22:05.123456",
  "end_time":   "2025-03-10T16:48:12.456789",
  "measured_hours": 2.435,
  ...
}
```

Rules:
- Returns `400` if task was never started.
- Returns `400` if task is already Completed.

---

### Dashboard

#### `GET /dashboard/summary`

Returns a single aggregated view across all data — the main screen for managers.

**Response**
```json
{
  "total_tasks": 12,
  "tasks_by_status": {
    "Pending": 5,
    "In Progress": 3,
    "Completed": 4
  },
  "tasks_by_priority": {
    "High": 6,
    "Medium": 4,
    "Critical": 2
  },
  "total_hours_logged": 47.3,
  "total_employees": 5,
  "total_projects": 3,
  "top_employees": [
    {
      "employee_id": 1,
      "employee_name": "Alice Dev",
      "total_tasks": 5,
      "completed_tasks": 4,
      "total_hours": 22.1
    }
  ],
  "project_summaries": [
    {
      "project_id": 1,
      "project_name": "Client Portal v2",
      "total_tasks": 8,
      "completed_tasks": 4,
      "total_hours": 47.3,
      "budget": 150000.0,
      "actual_cost": 138000.0
    }
  ]
}
```

---

### ML Prediction

#### `POST /predict` — Estimate task hours before starting

Uses the trained RandomForest model to predict how many hours a task will take, based on the employee profile and project context.

**Request body** (all fields optional — defaults are used for anything omitted)
```json
{
  "department": "Technology",
  "education": "Bachelor's",
  "age": 27,
  "previous_year_rating": 4.5,
  "length_of_service": 3,
  "no_of_trainings": 2,
  "KPIs_met_more_than_80": 1,
  "awards_won": 0,
  "avg_training_score": 72.0,
  "Budget": 150000.0,
  "Actual_Cost": 62000.0,
  "Delay_Days": 0,
  "Cost_Overrun_pct": 0.0,
  "Project_Type": "Web App",
  "Priority": "High",
  "Priority_Scaled": 3,
  "Tasks_Completed": 4,
  "Productivity_Score": 75.0,
  "Training_Effectiveness": 3.5,
  "Experience_Index": 3.0,
  "Workload_Pressure": 0.6
}
```

**Response**
```json
{
  "predicted_hours": 102.53,
  "model_mae": 3.998,
  "model_rmse": 5.617
}
```

| Response field | Meaning |
|---|---|
| `predicted_hours` | Estimated hours for the task |
| `model_mae` | Mean Absolute Error of the model on test data (±3.998 hrs) |
| `model_rmse` | Root Mean Squared Error (±5.617 hrs) |

Returns `503` if the model has not been trained yet (`python -m backend.ml.train_models`).

---

#### `GET /model-info` — Model metadata

Returns what features the model was trained on and its accuracy metrics.

```json
{
  "numeric_features": ["no_of_trainings", "age", "previous_year_rating", ...],
  "categorical_features": ["department", "education", "Project Type", "Priority"],
  "target": "Hours Spent",
  "metrics": { "mae": 3.998, "rmse": 5.617 }
}
```

---

## ML Model

| Property | Value |
|---|---|
| Algorithm | RandomForestRegressor (100 trees) |
| Target | Hours Spent on a task |
| Numeric features | 17 (age, ratings, scores, budget, delay days, …) |
| Categorical features | 4 (department, education, project type, priority) |
| Preprocessing | StandardScaler + OneHotEncoder via ColumnTransformer |
| Test MAE | **3.998 hours** |
| Test RMSE | **5.617 hours** |
| Training data | `final_dataset_with_features.csv` |

Retrain at any time (e.g. after new data arrives):
```powershell
python -m backend.ml.train_models
```

---

## Running Tests

```powershell
# All 30 tests
python -m pytest test/ -v

# API integration tests only
python -m pytest test/test_api.py -v

# Service unit tests only
python -m pytest test/test_service.py -v
```

Expected output: **30 passed, 0 warnings**.

Tests use an isolated in-memory SQLite database — the production `tasks.db` is never touched.

---

## Quick Reference — HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | Success |
| `201` | Resource created |
| `400` | Bad request (e.g. stopping a task that was never started) |
| `404` | Resource not found |
| `503` | ML model not trained yet |
