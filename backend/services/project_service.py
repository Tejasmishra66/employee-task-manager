from sqlalchemy.orm import Session
from fastapi import HTTPException

from backend.database import models
from backend.schemas.project_schema import ProjectCreate, ProjectUpdate


def get_all_projects(db: Session):
    return db.query(models.Project).all()


def get_project(db: Session, project_id: int):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


def create_project(db: Session, data: ProjectCreate):
    project = models.Project(**data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def update_project(db: Session, project_id: int, data: ProjectUpdate):
    project = get_project(db, project_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


def delete_project(db: Session, project_id: int):
    project = get_project(db, project_id)
    db.delete(project)
    db.commit()
    return {"detail": f"Project {project_id} deleted"}


def get_project_tasks(db: Session, project_id: int):
    get_project(db, project_id)   # raises 404 if missing
    return db.query(models.Task).filter(models.Task.project_id == project_id).all()
