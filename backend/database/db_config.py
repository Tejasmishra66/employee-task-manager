from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Resolve DB path relative to this file so it works regardless of working directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
DATABASE_URL = f"sqlite:///{BASE_DIR / 'tasks.db'}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
