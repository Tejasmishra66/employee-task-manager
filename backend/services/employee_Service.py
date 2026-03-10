from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.database import models
from backend.schemas.employee_schema import EmployeeCreate, EmployeeUpdate


def get_all_employees(db: Session):
    return db.query(models.Employee).all()


def get_employee(db: Session, employee_id: int):
    employee = db.query(models.Employee).filter(models.Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail=f"Employee {employee_id} not found")
    return employee


def create_employee(db: Session, data: EmployeeCreate):
    employee = models.Employee(**data.model_dump())
    db.add(employee)
    db.commit()
    db.refresh(employee)
    return employee


def update_employee(db: Session, employee_id: int, data: EmployeeUpdate):
    employee = get_employee(db, employee_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(employee, field, value)
    db.commit()
    db.refresh(employee)
    return employee


def delete_employee(db: Session, employee_id: int):
    employee = get_employee(db, employee_id)
    db.delete(employee)
    db.commit()
    return {"detail": f"Employee {employee_id} deleted"}


def get_employee_tasks(db: Session, employee_id: int):
    get_employee(db, employee_id)   # raises 404 if not found
    return db.query(models.Task).filter(models.Task.employee_id == employee_id).all()
