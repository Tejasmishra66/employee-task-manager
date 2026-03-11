# TaskFlow Pro — Employee Task & Time Management System

A full-stack web application for IT companies managing foreign client projects. Employees and managers can track tasks, log time automatically, monitor project budgets, and get ML-powered hour estimates — all from a single dashboard.

---

## Screenshots

| Dashboard | Tasks (Kanban) | ML Predict |
|---|---|---|
| Live stats, charts, top employees | Kanban board with live timer | Hour estimation from employee + project data |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python 3.9+) |
| Database | SQLite via SQLAlchemy ORM |
| Validation | Pydantic v2 |
| ML Model | scikit-learn RandomForestRegressor |
| Frontend | Vanilla HTML / CSS / JavaScript (SPA) |
| Charts | Chart.js |
| Tests | pytest + httpx (30 tests, 0 warnings) |

---

## Project Structure

```
employee/
├── backend/
│   ├── app.py                    ← FastAPI entry point + all routes + frontend serving
│   ├── database/
│   │   ├── db_config.py          ← SQLAlchemy engine, session, get_db()
│   │   └── models.py             ← ORM models: Employee, Project, Task
│   ├── schemas/
│   │   ├── employee_schema.py    ← Pydantic Create / Update / Response
│   │   ├── project_schema.py
│   │   ├── task_schema.py
│   │   ├── dashboard_schema.py
│   │   └── predict_schema.py
│   ├── services/
│   │   ├── employee_Service.py   ← Employee CRUD + sub-route logic
│   │   ├── project_service.py    ← Project CRUD + sub-route logic
│   │   └── task_service.py       ← Task CRUD, start/stop lifecycle, dashboard aggregation
│   ├── ml/
│   │   ├── train_models.py       ← Train RandomForest pipeline from CSV, save to disk
│   │   ├── predict.py            ← Load saved model, serve predictions
│   │   └── save_models/          ← model.joblib + metadata.json (after training)
│   └── utils/
│       ├── preprocessing.py      ← Load and clean final_dataset_with_features.csv
│       └── feature_engineering.py← Feature lists, derived columns, input row builder
├── frontend/
│   ├── index.html                ← SPA shell (Chart.js + Font Awesome via CDN)
│   ├── style.css                 ← Dark-theme design system (CSS variables + Grid)
│   └── app.js                    ← Full SPA: router, API client, all 5 pages
├── test/
│   ├── test_api.py               ← 16 integration tests (FastAPI TestClient)
│   └── test_service.py           ← 14 unit tests (in-memory SQLite)
├── final_dataset_with_features.csv
├── tasks.db                      ← SQLite database (auto-created on first run)
└── requirements.txt
```

---

## Quick Start

### 1. Clone and set up environment

```powershell
git clone <your-repo-url>
cd employee

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
```

### 2. Train the ML model (one-time)

```powershell
python -m backend.ml.train_models
```

Output:
```
Loading dataset...
Training model...
MAE : 3.998 hours
RMSE: 5.617 hours
Model saved to: backend/ml/save_models/model.joblib
```

### 3. Start the server

```powershell
uvicorn backend.app:app --reload --host 0.0.0.0 --port 8000
```

### 4. Open in browser

```
http://localhost:8000/
```

That is the only URL you need. The full dashboard opens immediately.

---

## URLs

| URL | What opens |
|---|---|
| `http://localhost:8000/` | Full interactive frontend dashboard |
| `http://localhost:8000/docs` | Swagger UI — try every API endpoint live |
| `http://localhost:8000/redoc` | ReDoc API documentation |
| `http://localhost:8000/health` | JSON health check `{"status":"ok"}` |

---

## Frontend Pages

### Dashboard
- 6 stat cards — total tasks, completed, in-progress, hours logged, employees, projects
- Tasks by Status doughnut chart (Chart.js)
- Tasks by Priority bar chart
- Top employees performance table
- Project overview table with budget tracking

### Employees
- Card grid with avatar, department, KPI badges, award badges
- Live search filter
- Add / Edit (full form modal) / Delete

### Projects
- Cards with dual progress bars — task completion % and budget utilisation %
- Budget bar turns red automatically when over 90% spent
- Add / Edit / Delete

### Tasks — Kanban Board
- Three columns: **Pending** · **In Progress** · **Completed**
- **Start** button stamps `start_time` and begins a live running clock
- **Stop** button stamps `end_time` and auto-calculates `measured_hours`
- Every active task shows an updating `HH:MM:SS` counter
- Add / Edit / Delete tasks

### ML Predict
- Full input form: employee profile + project context
- One-click prediction shows estimated hours in a result panel
- Model MAE and RMSE shown live
- Feature list pulled from `/model-info`

---

## Running Tests

```powershell
# All 30 tests
python -m pytest test/ -v

# Integration tests only (API layer)
python -m pytest test/test_api.py -v

# Unit tests only (service layer)
python -m pytest test/test_service.py -v
```

Expected: **30 passed, 0 warnings**

Tests run against an isolated in-memory SQLite database. The production `tasks.db` is never touched.

---

## API Reference

All request and response bodies are JSON. Base URL: `http://localhost:8000`

### Health

| Method | Route | Description |
|---|---|---|
| `GET` | `/health` | JSON status ping |

---

### Employees

| Method | Route | Description |
|---|---|---|
| `GET` | `/employees` | List all employees |
| `POST` | `/employees` | Create employee |
| `GET` | `/employees/{id}` | Get one employee |
| `PUT` | `/employees/{id}` | Update employee fields |
| `DELETE` | `/employees/{id}` | Delete employee |
| `GET` | `/employees/{id}/tasks` | All tasks assigned to this employee |

**Create / Update fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | Full name |
| `department` | string | yes | Technology / Management / Analytics / Design / QA / DevOps |
| `education` | string | yes | Bachelor's / Master's / PhD / Diploma |
| `age` | int | no | |
| `previous_year_rating` | float | no | 1.0 – 5.0 |
| `length_of_service` | int | no | Years at company |
| `no_of_trainings` | int | no | Default 0 |
| `KPIs_met_more_than_80` | int | no | 1 = yes, 0 = no |
| `awards_won` | int | no | 1 = yes, 0 = no |
| `avg_training_score` | float | no | 0 – 100 |

---

### Projects

| Method | Route | Description |
|---|---|---|
| `GET` | `/projects` | List all projects |
| `POST` | `/projects` | Create project |
| `GET` | `/projects/{id}` | Get one project |
| `PUT` | `/projects/{id}` | Update project fields |
| `DELETE` | `/projects/{id}` | Delete project |
| `GET` | `/projects/{id}/tasks` | All tasks under this project |

**Create / Update fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `name` | string | yes | |
| `project_type` | string | yes | Web App / Mobile App / API Integration / Data Pipeline / E-Commerce |
| `priority` | string | no | Low / Medium / High / Critical |
| `status` | string | no | In Progress / Completed / On Hold |
| `budget` | float | no | |
| `actual_cost` | float | no | |
| `start_date` | datetime | no | ISO 8601 |
| `planned_completion_date` | datetime | no | ISO 8601 |
| `actual_completion_date` | datetime | no | ISO 8601 |

---

### Tasks

| Method | Route | Description |
|---|---|---|
| `GET` | `/tasks` | List all tasks |
| `POST` | `/tasks` | Create task |
| `GET` | `/tasks/{id}` | Get one task |
| `PUT` | `/tasks/{id}` | Update task fields |
| `DELETE` | `/tasks/{id}` | Delete task |
| `POST` | `/tasks/{id}/start` | Begin timing → status becomes **In Progress** |
| `POST` | `/tasks/{id}/stop` | Stop timing → status becomes **Completed**, `measured_hours` auto-calculated |

**Create fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `title` | string | yes | |
| `description` | string | no | |
| `priority` | string | no | Low / Medium / High / Critical |
| `employee_id` | int | yes | Must exist |
| `project_id` | int | yes | Must exist |

**Task lifecycle:**
```
Pending  →  [POST /start]  →  In Progress  →  [POST /stop]  →  Completed
```
- `start` records `start_time`, fails with `400` if already Completed
- `stop` records `end_time`, computes `measured_hours = (end_time - start_time) / 3600`, fails with `400` if not started or already Completed

---

### Dashboard

| Method | Route | Description |
|---|---|---|
| `GET` | `/dashboard/summary` | Aggregated stats across all data |

Response includes: `total_tasks`, `tasks_by_status`, `tasks_by_priority`, `total_hours_logged`, `total_employees`, `total_projects`, `top_employees[]`, `project_summaries[]`

---

### ML Prediction

| Method | Route | Description |
|---|---|---|
| `POST` | `/predict` | Predict hours for a task |
| `GET` | `/model-info` | Model features and accuracy metrics |

All request fields are optional (sensible defaults used):

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
  "Project_Type": "Web App",
  "Priority": "High",
  "Tasks_Completed": 4,
  "Productivity_Score": 75.0,
  "Workload_Pressure": 0.6
}
```

Response:
```json
{
  "predicted_hours": 102.53,
  "model_mae": 3.998,
  "model_rmse": 5.617
}
```

Returns `503` if the model has not been trained yet.

---

## ML Model

| Property | Value |
|---|---|
| Algorithm | RandomForestRegressor — 100 trees |
| Target variable | Hours Spent on a task |
| Numeric features | 17 |
| Categorical features | 4 (department, education, project type, priority) |
| Preprocessing | StandardScaler + OneHotEncoder via ColumnTransformer |
| Test MAE | **±3.998 hours** |
| Test RMSE | **±5.617 hours** |
| Training data | `final_dataset_with_features.csv` |

Retrain any time (e.g. after onboarding new employees or completing more projects):
```powershell
python -m backend.ml.train_models
```

---

## HTTP Status Codes

| Code | Meaning |
|---|---|
| `200` | OK |
| `201` | Resource created |
| `400` | Invalid operation (e.g. stopping a task that was never started) |
| `404` | Resource not found |
| `503` | ML model not trained yet |

---

## Port Already in Use?

If you see `[WinError 10013]` when starting the server:

```powershell
# Find and kill what is using port 8000
Stop-Process -Id (netstat -ano | Select-String ':8000').ToString().Trim().Split()[-1] -Force

# Or just use a different port
uvicorn backend.app:app --reload --port 8001
```
