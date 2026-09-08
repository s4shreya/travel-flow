from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.exc import SQLAlchemyError

from core.config import POSTGRES_DATABASE_URL, logger


# Creates the SQLAlchemy engine
engine = create_engine(
    POSTGRES_DATABASE_URL,
    pool_recycle=1800,  # Close and refresh connections after 30 minutes
    pool_pre_ping=True,  # Enable automatic connection health check
)

# Creates the SessionLocal class whose instance will be a database session/connection
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


# Creates a Base class used to create database models
class Base(DeclarativeBase):
    pass


# Creates Dependency for DB session/connection
def get_db():
    db = SessionLocal()
    try:
        logger.info("Yield new db session created")
        yield db
    except SQLAlchemyError as e:
        logger.error(f"SQLAlchemy error occurred: {e}")
        db.rollback()
        raise e
    except Exception as e:
        logger.error(f"Unexpected error occurred in SQLAlchemy connection: {e}")
        db.rollback()
        raise e
    finally:
        logger.info("Closing db session")
        db.close()
