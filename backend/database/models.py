from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .db_config import Base


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    department = Column(String)
    education = Column(String)
    no_of_trainings = Column(Integer, default=0)
    age = Column(Integer)
    previous_year_rating = Column(Float)
    length_of_service = Column(Integer)
    KPIs_met_more_than_80 = Column(Integer, default=0)   # 0 or 1
    awards_won = Column(Integer, default=0)               # 0 or 1
    avg_training_score = Column(Float)

    tasks = relationship("Task", back_populates="employee")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    project_type = Column(String)                        # e.g. "Web App", "Mobile App"
    priority = Column(String, default="Medium")          # Low / Medium / High / Critical
    status = Column(String, default="In Progress")       # In Progress / Completed / On Hold
    start_date = Column(DateTime)
    planned_completion_date = Column(DateTime)
    actual_completion_date = Column(DateTime, nullable=True)
    budget = Column(Float, default=0.0)
    actual_cost = Column(Float, default=0.0)

    tasks = relationship("Task", back_populates="project")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(String)
    priority = Column(String, default="Medium")          # Low / Medium / High / Critical
    status = Column(String, default="Pending")           # Pending / In Progress / Completed
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    measured_hours = Column(Float, nullable=True)        # computed automatically on stop
    estimated_hours = Column(Float, nullable=True)       # ML prediction stored here

    employee_id = Column(Integer, ForeignKey("employees.id"))
    project_id = Column(Integer, ForeignKey("projects.id"))

    employee = relationship("Employee", back_populates="tasks")
    project = relationship("Project", back_populates="tasks")
